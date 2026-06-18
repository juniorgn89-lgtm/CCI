import { fetchVendaResumo, fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchTitulosPagar, fetchTitulosReceber, fetchMovimentosConta } from '@/api/endpoints/financeiro'
import { fetchAbastecimentos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchAbastecimentosCache, splitPeriodAtToday, buildCostMapFromLmc } from '@/api/supabase/apuracao'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import type { Produto } from '@/api/types/produto'
import { classifySetor, isVendaCancelada } from '@/lib/setorClassification'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { ClaudeToolDefinition } from './types'

/**
 * Tools que o Claude pode chamar. Cada tool tem 3 partes:
 *  - definition: schema JSON exposto pro modelo
 *  - executor: função TS que faz o trabalho (fetch + agregação)
 *  - resultToString: serializa o output pra retornar como tool_result
 *
 * Princípios:
 *  - Resultado SEMPRE pequeno (não dumpamos 10k linhas — agregamos)
 *  - empresaCodigo default = empresas selecionadas no filterStore
 *  - dataInicial/dataFinal default = período do filterStore
 *  - Errors viram { ok: false, error } no resultado — modelo decide explicar
 */

export interface ToolContext {
  /**
   * Empresas que o usuário logado tem PERMISSÃO de consultar.
   * - Lista vazia = sem restrição (master ou profile sem whitelist) → vê toda a rede.
   * - Lista preenchida = só esses postos são acessíveis.
   *
   * Note: NÃO usamos o filtro global do app aqui — o Assistente opera no
   * escopo TOTAL do usuário logado (não no filtro da UI), pra responder
   * "qualquer pergunta sobre a rede e os postos disponíveis pro user".
   */
  allowedEmpresaCodigos: number[]
  /** Data início default (mês corrente). Claude pode override via tool input. */
  dataInicial: string
  /** Data fim default (mês corrente). Claude pode override via tool input. */
  dataFinal: string
}

const fmt = (n: number, dec = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const resolveDates = (ctx: ToolContext, dataInicial?: string, dataFinal?: string) => ({
  dataInicial: dataInicial ?? ctx.dataInicial,
  dataFinal: dataFinal ?? ctx.dataFinal,
})

const resolveEmpresas = (ctx: ToolContext, override?: number[] | number) => {
  // Aceita Claude passando number único (apesar do schema dizer array)
  // — o modelo às vezes ignora o `type: array` quando tem só 1 valor.
  let requested: number[] | undefined
  if (typeof override === 'number') requested = [override]
  else if (Array.isArray(override)) requested = override

  // Sem override → usa TODOS os postos permitidos pro user (escopo total).
  if (!requested) return ctx.allowedEmpresaCodigos

  // Com override → intersecta com a whitelist do user pra evitar fuga de escopo.
  // Se user é unrestricted (allowedEmpresaCodigos vazio), passa direto.
  if (ctx.allowedEmpresaCodigos.length === 0) return requested
  const allowed = new Set(ctx.allowedEmpresaCodigos)
  return requested.filter((c) => allowed.has(c))
}

/** Cache do mapa codigo→nome de empresa pra evitar refetch em cada tool call. */
let _empresaMapCache: { fetchedAt: number; map: Map<number, string> } | null = null
const TTL_MS = 5 * 60 * 1000
const getEmpresaMap = async (): Promise<Map<number, string>> => {
  if (_empresaMapCache && Date.now() - _empresaMapCache.fetchedAt < TTL_MS) {
    return _empresaMapCache.map
  }
  const res = await fetchEmpresas()
  const map = new Map<number, string>()
  for (const e of res.resultados) {
    const nome = (e.fantasia || e.razao || '').trim() || `Empresa ${e.codigo}`
    map.set(e.codigo, nome)
  }
  _empresaMapCache = { fetchedAt: Date.now(), map }
  return map
}

/** Cache do mapa codigo→Produto (com nome/fabricante/etc) — pagina TODOS os
 * produtos da rede pra não cair em "Produto 12345" genérico quando o código
 * está além das primeiras 1000 entradas. */
let _produtoMapCache: { fetchedAt: number; map: Map<number, Produto> } | null = null
const getProdutoMap = async (): Promise<Map<number, Produto>> => {
  if (_produtoMapCache && Date.now() - _produtoMapCache.fetchedAt < TTL_MS) {
    return _produtoMapCache.map
  }
  const all = await fetchAllPages<Produto>(
    ({ ultimoCodigo, limite }) => fetchProdutos({ ultimoCodigo, limite }),
    1000,
    20, // até 20k produtos
  )
  const map = new Map<number, Produto>(all.map((p) => [p.produtoCodigo, p]))
  _produtoMapCache = { fetchedAt: Date.now(), map }
  return map
}

/** Cache do mapa grupoCodigo→tipoGrupo — pra classificar setor (régua de classificação:
 * combustível=tipoProduto "C", automotivos="Pista", conveniência="Conveniência"). */
let _grupoTipoCache: { fetchedAt: number; map: Map<number, string> } | null = null
const getGrupoTipoMap = async (): Promise<Map<number, string>> => {
  if (_grupoTipoCache && Date.now() - _grupoTipoCache.fetchedAt < TTL_MS) {
    return _grupoTipoCache.map
  }
  const all = await fetchAllPages(
    ({ ultimoCodigo, limite }) => fetchGrupos({ ultimoCodigo, limite }),
    1000,
    20,
  )
  const map = new Map<number, string>(all.map((g) => [g.grupoCodigo, g.tipoGrupo]))
  _grupoTipoCache = { fetchedAt: Date.now(), map }
  return map
}

/** Resolve nome legível pro produto. Cai pra alternativas quando `nome` é vazio. */
const produtoLabel = (p: Produto | undefined, codigo: number): string => {
  if (!p) return `Produto ${codigo} (não cadastrado)`
  const candidatos = [p.nome, p.descricaoFabricante, p.referenciaCodigo, p.produtoCodigoExterno]
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return `Produto ${codigo}`
}

/**
 * Códigos de barras (EAN) do produto. `principal` = primeiro EAN não vazio;
 * cai pra produtoCodigoExterno / referenciaCodigo quando não há EAN cadastrado
 * (mesma ordem de fallback do produtoLabel). `todos` lista todos os EANs.
 */
const barcodesOf = (p: Produto | undefined): { principal: string | null; todos: string[] } => {
  const todos = (p?.produtoCodigoBarra ?? [])
    .map((b) => (b.codigoBarra ?? '').trim())
    .filter((c) => c.length > 0)
  const fallback = [p?.produtoCodigoExterno, p?.referenciaCodigo]
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .find((c) => c.length > 0)
  return { principal: todos[0] ?? fallback ?? null, todos }
}

/* ─── Tool 1: faturamento por período (com breakdown por posto) ─── */

const getFaturamentoPeriodo = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; empresaCodigo?: number[] },
) => {
  const { dataInicial, dataFinal } = resolveDates(ctx, input.dataInicial, input.dataFinal)
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresaMap = await getEmpresaMap()

  const resumo = await fetchVendaResumo({
    empresaCodigo: empresas.length > 0 ? empresas : undefined,
    dataInicial,
    dataFinal,
    situacao: 'A',
  })

  // Filtro defensivo client-side: se a API retornar empresas além do filtro
  // (paginação/agregação inconsistente do Quality), descartamos aqui.
  const empresasSet = new Set(empresas)
  const filtered = empresas.length > 0
    ? resumo.filter((r) => empresasSet.has(r.codigoEmpresa))
    : resumo

  let total = 0
  let qtdNotas = 0
  const porDia = new Map<string, number>()
  const porModelo = new Map<string, number>()
  const porEmpresa = new Map<number, { total: number; qtd: number }>()

  for (const r of filtered) {
    total += r.total ?? 0
    qtdNotas += r.quantidade ?? 0
    if (r.data) {
      porDia.set(r.data, (porDia.get(r.data) ?? 0) + (r.total ?? 0))
    }
    if (r.modelo) {
      porModelo.set(r.modelo, (porModelo.get(r.modelo) ?? 0) + (r.total ?? 0))
    }
    if (r.codigoEmpresa) {
      const cur = porEmpresa.get(r.codigoEmpresa) ?? { total: 0, qtd: 0 }
      cur.total += r.total ?? 0
      cur.qtd += r.quantidade ?? 0
      porEmpresa.set(r.codigoEmpresa, cur)
    }
  }

  const diasOrdenados = Array.from(porDia.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, valor]) => ({ data, valor: Number(valor.toFixed(2)) }))

  const empresasBreakdown = Array.from(porEmpresa.entries())
    .map(([codigo, v]) => ({
      empresaCodigo: codigo,
      empresaNome: empresaMap.get(codigo) ?? `Empresa ${codigo}`,
      faturamento: Number(v.total.toFixed(2)),
      faturamento_brl: `R$ ${fmt(v.total)}`,
      quantidade_notas: v.qtd,
      ticket_medio_brl: v.qtd > 0 ? `R$ ${fmt(v.total / v.qtd)}` : 'R$ 0,00',
    }))
    .sort((a, b) => b.faturamento - a.faturamento)

  return {
    periodo: { dataInicial, dataFinal },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    faturamento_total: Number(total.toFixed(2)),
    faturamento_total_brl: `R$ ${fmt(total)}`,
    quantidade_notas: qtdNotas,
    ticket_medio: qtdNotas > 0 ? Number((total / qtdNotas).toFixed(2)) : 0,
    por_modelo_documento: Object.fromEntries(porModelo.entries()),
    por_empresa: empresasBreakdown,
    por_dia: diasOrdenados.slice(0, 31),
  }
}

/* ─── Tool 2: volume e faturamento por combustível ─── */

const getVolumeCombustivel = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; combustivelNome?: string; empresaCodigo?: number[] },
) => {
  const { dataInicial, dataFinal } = resolveDates(ctx, input.dataInicial, input.dataFinal)
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresasSet = new Set(empresas)
  const empresaMap = await getEmpresaMap()

  // Mapa completo de produtos (paginado + cacheado)
  const produtoMap = await getProdutoMap()

  const abast = await fetchAllPages<Awaited<ReturnType<typeof fetchAbastecimentos>>['resultados'][number]>(
    ({ ultimoCodigo, limite }) =>
      fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo, limite }),
    1000,
    30,
  )

  const filtroNome = input.combustivelNome?.toLowerCase().trim()
  const porProduto = new Map<number, { nome: string; litros: number; faturamento: number; qtd: number }>()
  const porEmpresa = new Map<number, { litros: number; faturamento: number; qtd: number }>()

  for (const a of abast) {
    // Filtro client-side por empresa — endpoint /ABASTECIMENTO não aceita esse filtro
    if (empresas.length > 0 && !empresasSet.has(a.empresaCodigo)) continue
    if (a.afericao) continue // exclui aferição (igual às telas Combustível/Produtividade)
    const nome = produtoLabel(produtoMap.get(a.codigoProduto), a.codigoProduto)
    if (filtroNome && !nome.toLowerCase().includes(filtroNome)) continue
    const cur = porProduto.get(a.codigoProduto) ?? { nome, litros: 0, faturamento: 0, qtd: 0 }
    cur.litros += a.quantidade
    cur.faturamento += a.valorTotal
    cur.qtd += 1
    porProduto.set(a.codigoProduto, cur)

    const e = porEmpresa.get(a.empresaCodigo) ?? { litros: 0, faturamento: 0, qtd: 0 }
    e.litros += a.quantidade
    e.faturamento += a.valorTotal
    e.qtd += 1
    porEmpresa.set(a.empresaCodigo, e)
  }

  const lista = Array.from(porProduto.values())
    .sort((a, b) => b.litros - a.litros)
    .map((c) => ({
      produto: c.nome,
      litros: Number(c.litros.toFixed(2)),
      faturamento: Number(c.faturamento.toFixed(2)),
      faturamento_brl: `R$ ${fmt(c.faturamento)}`,
      preco_medio_unitario: c.litros > 0 ? Number((c.faturamento / c.litros).toFixed(3)) : 0,
      quantidade_abastecimentos: c.qtd,
    }))

  const empresasBreakdown = Array.from(porEmpresa.entries())
    .map(([codigo, v]) => ({
      empresaCodigo: codigo,
      empresaNome: empresaMap.get(codigo) ?? `Empresa ${codigo}`,
      litros: Number(v.litros.toFixed(2)),
      faturamento: Number(v.faturamento.toFixed(2)),
      faturamento_brl: `R$ ${fmt(v.faturamento)}`,
      quantidade_abastecimentos: v.qtd,
    }))
    .sort((a, b) => b.litros - a.litros)

  return {
    periodo: { dataInicial, dataFinal },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    filtro_combustivel: filtroNome ?? 'todos',
    total_litros: Number(lista.reduce((s, x) => s + x.litros, 0).toFixed(2)),
    total_faturamento: Number(lista.reduce((s, x) => s + x.faturamento, 0).toFixed(2)),
    por_combustivel: lista,
    por_empresa: empresasBreakdown,
  }
}

/* ─── Tool 3: top produtos vendidos (geral / conveniência) ─── */

const getTopProdutos = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; limite?: number; categoria?: 'combustivel' | 'conveniencia'; empresaCodigo?: number[] },
) => {
  const { dataInicial, dataFinal } = resolveDates(ctx, input.dataInicial, input.dataFinal)
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresasSet = new Set(empresas)
  const limite = Math.min(input.limite ?? 10, 25)

  const produtoMap = await getProdutoMap()
  const grupoTipo = await getGrupoTipoMap()

  // /VENDA_ITEM exige empresaCodigo no Quality API — sem ele o request crasha.
  // Pra cobrir master (várias empresas) e usuário com 1 empresa, iteramos a lista.
  // Se a lista estiver vazia (config inesperada), fallback pra fetch sem filtro.
  const empresasToQuery: Array<number | undefined> = empresas.length > 0 ? empresas : [undefined]
  const itensArrays = await Promise.all(
    empresasToQuery.map((empCod) =>
      fetchAllPages<Awaited<ReturnType<typeof fetchVendaItens>>['resultados'][number]>(
        ({ ultimoCodigo, limite }) =>
          fetchVendaItens({ empresaCodigo: empCod, dataInicial, dataFinal, ultimoCodigo, limite }),
        1000,
        30,
      ),
    ),
  )
  const itens = itensArrays.flat()

  const por = new Map<number, { produtoCodigo: number; nome: string; qtd: number; faturamento: number; setor: string }>()
  for (const i of itens) {
    if (isVendaCancelada(i)) continue  // conta só cancelada="N"
    // Filtro defensivo (em caso do fallback sem filtro ter retornado todas).
    if (empresas.length > 0 && !empresasSet.has(i.empresaCodigo)) continue
    const p = produtoMap.get(i.produtoCodigo)
    // Régua: combustível=tipoProduto "C"; conveniência=tipoGrupo "Conveniência".
    const setor = classifySetor(p?.tipoProduto, p ? grupoTipo.get(p.grupoCodigo) : undefined)
    if (input.categoria === 'combustivel' && setor !== 'combustivel') continue
    if (input.categoria === 'conveniencia' && setor !== 'conveniencia') continue
    const nome = produtoLabel(p, i.produtoCodigo)
    const cur = por.get(i.produtoCodigo) ?? { produtoCodigo: i.produtoCodigo, nome, qtd: 0, faturamento: 0, setor }
    cur.qtd += i.quantidade
    cur.faturamento += i.totalVenda
    por.set(i.produtoCodigo, cur)
  }

  const top = Array.from(por.values())
    .sort((a, b) => b.faturamento - a.faturamento)
    .slice(0, limite)
    .map((x) => {
      const barras = barcodesOf(produtoMap.get(x.produtoCodigo))
      return {
        produto: x.nome,
        produto_codigo: x.produtoCodigo,
        codigo_barras: barras.principal,
        codigos_barras: barras.todos,
        categoria: x.setor,
        quantidade: Number(x.qtd.toFixed(3)),
        faturamento: Number(x.faturamento.toFixed(2)),
        faturamento_brl: `R$ ${fmt(x.faturamento)}`,
      }
    })

  return {
    periodo: { dataInicial, dataFinal },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    categoria: input.categoria ?? 'todas',
    top,
  }
}

/* ─── Tool 4: top frentistas por volume / faturamento ─── */

const getTopFrentistas = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; metrica?: 'litros' | 'faturamento'; limite?: number; empresaCodigo?: number[] },
) => {
  const { dataInicial, dataFinal } = resolveDates(ctx, input.dataInicial, input.dataFinal)
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresasSet = new Set(empresas)
  const limite = Math.min(input.limite ?? 10, 20)
  const metrica = input.metrica ?? 'litros'
  const empresaMap = await getEmpresaMap()

  const [funcRes, abast] = await Promise.all([
    fetchFuncionarios({ limite: 1000 }),
    fetchAllPages<Awaited<ReturnType<typeof fetchAbastecimentos>>['resultados'][number]>(
      ({ ultimoCodigo, limite }) =>
        fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo, limite }),
      1000,
      30,
    ),
  ])
  const funcNome = new Map<number, string>(funcRes.resultados.map((f) => [f.funcionarioCodigo, f.nome ?? '']))

  const por = new Map<number, { nome: string; litros: number; faturamento: number; qtd: number; empresaCodigo: number }>()
  for (const a of abast) {
    if (!a.codigoFrentista) continue
    // Filtro client-side por empresa
    if (empresas.length > 0 && !empresasSet.has(a.empresaCodigo)) continue
    if (a.afericao) continue // exclui aferição (igual à tela Produtividade)
    const nome = funcNome.get(a.codigoFrentista) ?? `Frentista ${a.codigoFrentista}`
    const cur = por.get(a.codigoFrentista) ?? { nome, litros: 0, faturamento: 0, qtd: 0, empresaCodigo: a.empresaCodigo }
    cur.litros += a.quantidade
    cur.faturamento += a.valorTotal
    cur.qtd += 1
    por.set(a.codigoFrentista, cur)
  }

  const sorted = Array.from(por.values()).sort((a, b) =>
    metrica === 'litros' ? b.litros - a.litros : b.faturamento - a.faturamento,
  )

  return {
    periodo: { dataInicial, dataFinal },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    metrica,
    total_frentistas_no_periodo: sorted.length,
    top: sorted.slice(0, limite).map((x) => ({
      frentista: x.nome,
      empresaCodigo: x.empresaCodigo,
      empresaNome: empresaMap.get(x.empresaCodigo) ?? `Empresa ${x.empresaCodigo}`,
      litros: Number(x.litros.toFixed(2)),
      faturamento: Number(x.faturamento.toFixed(2)),
      faturamento_brl: `R$ ${fmt(x.faturamento)}`,
      qtd_abastecimentos: x.qtd,
      ticket_medio_brl: x.qtd > 0 ? `R$ ${fmt(x.faturamento / x.qtd)}` : 'R$ 0,00',
    })),
  }
}

/* ─── Tool 5: última compra (entrada de combustível do fornecedor) por posto ─── */

const getUltimaCompraCombustivel = async (
  ctx: ToolContext,
  input: { combustivelNome?: string; empresaCodigo?: number[]; diasAtras?: number },
) => {
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresaMap = await getEmpresaMap()
  const produtoMap = await getProdutoMap()

  // Janela de busca — padrão 90 dias
  const diasAtras = Math.min(Math.max(input.diasAtras ?? 90, 7), 365)
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - diasAtras)
  const dataInicial = inicio.toISOString().slice(0, 10)
  const dataFinal = hoje.toISOString().slice(0, 10)

  // Identifica os produtos que batem com a busca (ex: "gasolina comum")
  const filtroNome = (input.combustivelNome ?? '').toLowerCase().trim()
  const produtoCodigosMatching = new Set<number>()
  for (const [code, p] of produtoMap) {
    if (!p.combustivel) continue
    if (!filtroNome) {
      produtoCodigosMatching.add(code)
      continue
    }
    const nome = produtoLabel(p, code).toLowerCase()
    if (nome.includes(filtroNome)) produtoCodigosMatching.add(code)
  }

  if (produtoCodigosMatching.size === 0) {
    return {
      periodo_consultado: { dataInicial, dataFinal },
      combustivel_buscado: filtroNome || 'todos',
      erro: `Nenhum combustível com nome contendo "${filtroNome}" está cadastrado. Verifique o nome exato no Quality.`,
    }
  }

  // Busca LMC do período (origem 'C' = compra)
  const lmcs = await fetchAllPages<Awaited<ReturnType<typeof fetchLmc>>['resultados'][number]>(
    ({ ultimoCodigo, limite }) =>
      fetchLmc({
        empresaCodigo: empresas.length > 0 ? empresas : undefined,
        dataInicial,
        dataFinal,
        ultimoCodigo,
        limite,
      }),
    1000,
    30,
  )

  // Pra cada empresa, mantém apenas o LMC mais recente com entrada > 0 do produto buscado
  interface UltimaCompra {
    data: string
    produtoCodigo: number
    produtoNome: string
    volumeLitros: number
    custoUnitario: number
    valorTotal: number
    numeroNota: string
    fornecedorCompraCodigo: number | null
  }
  const porEmpresa = new Map<number, UltimaCompra>()
  for (const lmc of lmcs) {
    if (lmc.entrada <= 0) continue
    if (!lmc.lmcNota || lmc.lmcNota.length === 0) continue
    const matchingProdCode = lmc.produtoCodigo?.find((c: number) => produtoCodigosMatching.has(c))
    if (!matchingProdCode) continue

    const cur = porEmpresa.get(lmc.empresaCodigo)
    if (cur && cur.data >= lmc.dataMovimento) continue

    const totalVol = lmc.lmcNota.reduce((s: number, n) => s + (n.volumeRecebido ?? 0), 0)
    const ultimaNota = [...lmc.lmcNota].sort((a, b) =>
      (b.dataEntrada ?? '').localeCompare(a.dataEntrada ?? ''),
    )[0]
    const volume = totalVol || lmc.entrada
    const custoUnit = lmc.precoCusto ?? 0

    porEmpresa.set(lmc.empresaCodigo, {
      data: lmc.dataMovimento,
      produtoCodigo: matchingProdCode,
      produtoNome: produtoLabel(produtoMap.get(matchingProdCode), matchingProdCode),
      volumeLitros: volume,
      custoUnitario: custoUnit,
      valorTotal: volume * custoUnit,
      numeroNota: ultimaNota?.numeroNota ?? '',
      fornecedorCompraCodigo: ultimaNota?.compraCodigo ?? null,
    })
  }

  const por_empresa = Array.from(porEmpresa.entries())
    .map(([empCod, info]) => ({
      empresaCodigo: empCod,
      empresaNome: empresaMap.get(empCod) ?? `Empresa ${empCod}`,
      data: info.data,
      produto: info.produtoNome,
      volume_litros: Number(info.volumeLitros.toFixed(2)),
      custo_unitario: Number(info.custoUnitario.toFixed(4)),
      custo_unitario_brl: `R$ ${fmt(info.custoUnitario, 4)}`,
      valor_total: Number(info.valorTotal.toFixed(2)),
      valor_total_brl: `R$ ${fmt(info.valorTotal)}`,
      numero_nota_fiscal: info.numeroNota || null,
      compra_codigo: info.fornecedorCompraCodigo,
    }))
    .sort((a, b) => b.data.localeCompare(a.data))

  return {
    periodo_consultado: { dataInicial, dataFinal },
    combustivel_buscado: filtroNome || 'todos',
    quantidade_postos_com_compra: por_empresa.length,
    por_empresa: por_empresa.length > 0
      ? por_empresa
      : `Nenhuma compra (entrada de combustível) encontrada no período. Tente aumentar diasAtras ou trocar combustivelNome.`,
  }
}

/* ─── Tool 6: lucro bruto e margem por combustível (vendas × custo /LMC) ─── */

// Subtrai N meses de uma data yyyy-MM-dd — lookback do custo no LMC.
const monthsBeforeISO = (dateStr: string, months: number): string => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setMonth(d.getMonth() - months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getLucroCombustivel = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; combustivelNome?: string; empresaCodigo?: number[] },
) => {
  const { dataInicial, dataFinal } = resolveDates(ctx, input.dataInicial, input.dataFinal)
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresasSet = new Set(empresas)
  const empresaMap = await getEmpresaMap()
  const produtoMap = await getProdutoMap()

  // FONTE DO CUSTO: o custo por abastecimento JÁ É gravado pela apuração na
  // tabela apuracao_abastecimentos (mesmo número que a tela Combustível usa).
  // NÃO re-derivamos custo via LMC live aqui — esse cruzamento é incompleto e
  // dava cobertura baixíssima. Dias fechados → cache; "hoje" (volátil, não
  // apurado) → live + LMC só pra esse 1 dia.
  const split = splitPeriodAtToday(dataInicial, dataFinal)
  interface Linha { empresaCodigo: number; codigoProduto: number; quantidade: number; valorTotal: number; custoUnit: number | null }
  const linhas: Linha[] = []

  if (split.closedDays) {
    const cacheRows = await fetchAbastecimentosCache({
      empresaCodigos: empresas.length > 0 ? empresas : undefined,
      dataInicial: split.closedDays.dataInicial,
      dataFinal: split.closedDays.dataFinal,
    })
    for (const r of cacheRows) {
      linhas.push({
        empresaCodigo: r.empresa_codigo,
        codigoProduto: r.codigo_produto ?? 0,
        quantidade: r.quantidade,
        valorTotal: r.valor_total,
        custoUnit: typeof r.preco_custo === 'number' && r.preco_custo > 0 ? r.preco_custo : null,
      })
    }
  }

  // Sliver volátil (hoje) — não está no cache; resolve custo pelo LMC recente.
  if (split.todayPart) {
    const lmcInicial = monthsBeforeISO(split.todayPart.dataInicial, 3)
    const [liveAbast, lmcs] = await Promise.all([
      fetchAllPages<Awaited<ReturnType<typeof fetchAbastecimentos>>['resultados'][number]>(
        ({ ultimoCodigo, limite }) =>
          fetchAbastecimentos({ dataInicial: split.todayPart!.dataInicial, dataFinal: split.todayPart!.dataFinal, ultimoCodigo, limite }),
        1000, 10,
      ),
      fetchAllPages<Awaited<ReturnType<typeof fetchLmc>>['resultados'][number]>(
        ({ ultimoCodigo, limite }) =>
          fetchLmc({ empresaCodigo: empresas.length > 0 ? empresas : undefined, dataInicial: lmcInicial, dataFinal: split.todayPart!.dataFinal, ultimoCodigo, limite }),
        1000, 20,
      ),
    ])
    const costMap = buildCostMapFromLmc(lmcs)
    for (const a of liveAbast) {
      if (empresas.length > 0 && !empresasSet.has(a.empresaCodigo)) continue
      if (a.afericao) continue // exclui aferição (igual à tela Combustível)
      const c = costMap.get(`${a.empresaCodigo}-${a.codigoProduto}`)
      linhas.push({
        empresaCodigo: a.empresaCodigo,
        codigoProduto: a.codigoProduto,
        quantidade: a.quantidade,
        valorTotal: a.valorTotal,
        custoUnit: typeof c === 'number' && c > 0 ? c : null,
      })
    }
  }

  if (linhas.length === 0) {
    return {
      periodo: { dataInicial, dataFinal },
      erro: split.closedDays
        ? 'Esse período (dias fechados) ainda NÃO foi apurado — não há custo gravado pra calcular lucro bruto. Rode a apuração no módulo Admin → Apuração e tente de novo.'
        : 'Sem abastecimentos no período consultado.',
    }
  }

  const filtroNome = input.combustivelNome?.toLowerCase().trim()
  interface Agg { nome: string; litros: number; faturamento: number; custoTotal: number; litrosComCusto: number }
  const porProduto = new Map<number, Agg>()
  const porEmpresa = new Map<number, Omit<Agg, 'nome'>>()

  for (const a of linhas) {
    if (empresas.length > 0 && !empresasSet.has(a.empresaCodigo)) continue
    const p = produtoMap.get(a.codigoProduto)
    if (p && p.combustivel === false) continue // mantém só combustível
    const nome = produtoLabel(p, a.codigoProduto)
    if (filtroNome && !nome.toLowerCase().includes(filtroNome)) continue
    const custoUnit = a.custoUnit ?? 0
    const custoLinha = custoUnit > 0 ? custoUnit * a.quantidade : 0

    const cur = porProduto.get(a.codigoProduto) ?? { nome, litros: 0, faturamento: 0, custoTotal: 0, litrosComCusto: 0 }
    cur.litros += a.quantidade
    cur.faturamento += a.valorTotal
    cur.custoTotal += custoLinha
    if (custoUnit > 0) cur.litrosComCusto += a.quantidade
    porProduto.set(a.codigoProduto, cur)

    const e = porEmpresa.get(a.empresaCodigo) ?? { litros: 0, faturamento: 0, custoTotal: 0, litrosComCusto: 0 }
    e.litros += a.quantidade
    e.faturamento += a.valorTotal
    e.custoTotal += custoLinha
    if (custoUnit > 0) e.litrosComCusto += a.quantidade
    porEmpresa.set(a.empresaCodigo, e)
  }
  const mapAgg = (litros: number, faturamento: number, custoTotal: number, litrosComCusto: number) => {
    const lucro = faturamento - custoTotal
    return {
      litros: Number(litros.toFixed(2)),
      faturamento: Number(faturamento.toFixed(2)),
      faturamento_brl: `R$ ${fmt(faturamento)}`,
      custo_total_brl: `R$ ${fmt(custoTotal)}`,
      lucro_bruto: Number(lucro.toFixed(2)),
      lucro_bruto_brl: `R$ ${fmt(lucro)}`,
      margem_pct: faturamento > 0 ? Number(((lucro / faturamento) * 100).toFixed(2)) : 0,
      lb_por_litro: litros > 0 ? Number((lucro / litros).toFixed(4)) : 0,
      cobertura_custo_pct: litros > 0 ? Number(((litrosComCusto / litros) * 100).toFixed(1)) : 0,
    }
  }

  const por_combustivel = Array.from(porProduto.values())
    .map((c) => ({ produto: c.nome, ...mapAgg(c.litros, c.faturamento, c.custoTotal, c.litrosComCusto) }))
    .sort((a, b) => b.lucro_bruto - a.lucro_bruto)

  const por_empresa = Array.from(porEmpresa.entries())
    .map(([codigo, v]) => ({
      empresaCodigo: codigo,
      empresaNome: empresaMap.get(codigo) ?? `Empresa ${codigo}`,
      ...mapAgg(v.litros, v.faturamento, v.custoTotal, v.litrosComCusto),
    }))
    .sort((a, b) => b.lucro_bruto - a.lucro_bruto)

  const totalFat = por_combustivel.reduce((s, x) => s + x.faturamento, 0)
  const totalLitros = por_combustivel.reduce((s, x) => s + x.litros, 0)
  const totalCusto = Array.from(porProduto.values()).reduce((s, x) => s + x.custoTotal, 0)
  const totalLitrosComCusto = Array.from(porProduto.values()).reduce((s, x) => s + x.litrosComCusto, 0)
  const lucroTotal = totalFat - totalCusto
  const coberturaPct = totalLitros > 0 ? (totalLitrosComCusto / totalLitros) * 100 : 0

  return {
    periodo: { dataInicial, dataFinal },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    filtro_combustivel: filtroNome ?? 'todos',
    metodo_custo: 'lucro bruto = faturamento − (custo unitário × litros). Custo = preço de custo gravado por abastecimento na apuração (mesma base da tela Combustível); dias fechados vêm do cache de apuração, o dia corrente do LMC mais recente.',
    cobertura_custo_pct: Number(coberturaPct.toFixed(1)),
    aviso_cobertura: coberturaPct < 95
      ? `Atenção: ${coberturaPct.toFixed(2)}% dos litros tinham custo apurado. Os litros sem custo entram com custo 0 (margem ~100%) e inflam o lucro. Provável causa: período não reapurado após cadastro de custos, ou produto sem custo. Sinalize isso na resposta e sugira reapurar no Admin → Apuração.`
      : null,
    total: {
      litros: Number(totalLitros.toFixed(2)),
      faturamento_brl: `R$ ${fmt(totalFat)}`,
      custo_total_brl: `R$ ${fmt(totalCusto)}`,
      lucro_bruto: Number(lucroTotal.toFixed(2)),
      lucro_bruto_brl: `R$ ${fmt(lucroTotal)}`,
      margem_pct: totalFat > 0 ? Number(((lucroTotal / totalFat) * 100).toFixed(2)) : 0,
    },
    por_combustivel,
    por_empresa,
  }
}

/* ─── Tool 7: lista de empresas (postos) — útil pra resolver "qual posto" ─── */

const getEmpresas = async () => {
  const res = await fetchEmpresas()
  return {
    empresas: res.resultados.map((e) => ({
      codigo: e.codigo,
      // Empresa.nome não existe — usa fantasia (mais usual) ou razao (formal)
      nome: (e.fantasia || e.razao || '').trim() || `Empresa ${e.codigo}`,
      razao_social: e.razao,
      nome_fantasia: e.fantasia,
      cnpj: e.cnpj,
      cidade: e.cidade,
      estado: e.estado,
    })),
  }
}

/* ─── Definições expostas pro modelo ─── */

/* ─── Tool 8: contas a pagar (financeiro / TITULO_PAGAR — só leitura) ─── */

const getContasPagar = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; apenasPendente?: boolean; empresaCodigo?: number[] },
) => {
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresasSet = new Set(empresas)
  const empresaMap = await getEmpresaMap()
  const hoje = new Date().toISOString().slice(0, 10)
  const ateData = input.dataFinal ?? hoje
  const apenasPendente = input.apenasPendente ?? true

  // /TITULO_PAGAR aceita 1 empresaCodigo — itera a lista (master = vários postos).
  const empresasToQuery: Array<number | undefined> = empresas.length > 0 ? empresas : [undefined]
  const titulosArrays = await Promise.all(
    empresasToQuery.map((empCod) =>
      fetchAllPages<Awaited<ReturnType<typeof fetchTitulosPagar>>['resultados'][number]>(
        ({ ultimoCodigo, limite }) =>
          fetchTitulosPagar({
            empresaCodigo: empCod,
            dataInicial: input.dataInicial,
            dataFinal: ateData,
            dataFiltro: 'VENCIMENTO',
            apenasPendente,
            ultimoCodigo,
            limite,
          }),
        1000,
        30,
      ),
    ),
  )
  const titulos = titulosArrays.flat()

  let totalAberto = 0
  let totalVencido = 0
  let qtd = 0
  const porFornecedor = new Map<string, { valor: number; qtd: number }>()
  const porEmpresa = new Map<number, number>()
  const porPlano = new Map<string, number>()
  const proximos: Array<{ vencimento: string; fornecedor: string; valor: number; descricao: string; empresa: string }> = []

  for (const t of titulos) {
    if (empresas.length > 0 && !empresasSet.has(t.empresaCodigo)) continue
    const aberto = Math.max(0, (t.valor ?? 0) - (t.valorPago ?? 0))
    if (aberto <= 0) continue
    qtd += 1
    totalAberto += aberto
    const venc = (t.vencimento ?? '').slice(0, 10)
    if (venc && venc < hoje) totalVencido += aberto
    const forn = t.nomeFornecedor || `Fornecedor ${t.fornecedorCodigo}`
    const cf = porFornecedor.get(forn) ?? { valor: 0, qtd: 0 }
    cf.valor += aberto
    cf.qtd += 1
    porFornecedor.set(forn, cf)
    porEmpresa.set(t.empresaCodigo, (porEmpresa.get(t.empresaCodigo) ?? 0) + aberto)
    const plano = t.planoContaGerencialDescricao || 'Sem classificação'
    porPlano.set(plano, (porPlano.get(plano) ?? 0) + aberto)
    proximos.push({
      vencimento: venc,
      fornecedor: forn,
      valor: Number(aberto.toFixed(2)),
      descricao: t.descricao || t.numeroTitulo || '',
      empresa: empresaMap.get(t.empresaCodigo) ?? `Empresa ${t.empresaCodigo}`,
    })
  }

  const fornecedoresTop = Array.from(porFornecedor.entries())
    .map(([nome, v]) => ({ fornecedor: nome, valor: Number(v.valor.toFixed(2)), valor_brl: `R$ ${fmt(v.valor)}`, titulos: v.qtd }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 15)
  const empresasBreakdown = Array.from(porEmpresa.entries())
    .map(([cod, v]) => ({ empresaNome: empresaMap.get(cod) ?? `Empresa ${cod}`, valor: Number(v.toFixed(2)), valor_brl: `R$ ${fmt(v)}` }))
    .sort((a, b) => b.valor - a.valor)
  const planoBreakdown = Array.from(porPlano.entries())
    .map(([nome, v]) => ({ categoria: nome, valor: Number(v.toFixed(2)), valor_brl: `R$ ${fmt(v)}` }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 15)
  const proximosVenc = proximos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 20)

  return {
    referencia: { ate_data: ateData, data_inicial: input.dataInicial ?? null, apenas_pendentes: apenasPendente, hoje },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    total_a_pagar: Number(totalAberto.toFixed(2)),
    total_a_pagar_brl: `R$ ${fmt(totalAberto)}`,
    total_vencido_brl: `R$ ${fmt(totalVencido)}`,
    total_a_vencer_brl: `R$ ${fmt(totalAberto - totalVencido)}`,
    quantidade_titulos: qtd,
    por_fornecedor: fornecedoresTop,
    por_empresa: empresasBreakdown,
    por_categoria: planoBreakdown,
    proximos_vencimentos: proximosVenc,
  }
}

/* ─── Tool 9: contas a receber (financeiro / TITULO_RECEBER — só leitura) ─── */

const getContasReceber = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; apenasPendente?: boolean; empresaCodigo?: number[] },
) => {
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresasSet = new Set(empresas)
  const empresaMap = await getEmpresaMap()
  const hoje = new Date().toISOString().slice(0, 10)
  const apenasPendente = input.apenasPendente ?? true
  // /TITULO_RECEBER exige data inicial e final. Janela default: 1 ano pra trás
  // (recebíveis vencidos) e 1 ano pra frente (a vencer).
  const umAnoMs = 365 * 24 * 3600 * 1000
  const dataInicial = input.dataInicial ?? new Date(Date.now() - umAnoMs).toISOString().slice(0, 10)
  const dataFinal = input.dataFinal ?? new Date(Date.now() + umAnoMs).toISOString().slice(0, 10)

  // /TITULO_RECEBER aceita 1 empresaCodigo — itera a lista (master = vários postos).
  const empresasToQuery: Array<number | undefined> = empresas.length > 0 ? empresas : [undefined]
  const titulosArrays = await Promise.all(
    empresasToQuery.map((empCod) =>
      fetchAllPages<Awaited<ReturnType<typeof fetchTitulosReceber>>['resultados'][number]>(
        ({ ultimoCodigo, limite }) =>
          fetchTitulosReceber({
            empresaCodigo: empCod,
            dataInicial,
            dataFinal,
            dataFiltro: 'VENCIMENTO',
            apenasPendente,
            ultimoCodigo,
            limite,
          }),
        1000,
        30,
      ),
    ),
  )
  const titulos = titulosArrays.flat()

  let totalAberto = 0
  let totalVencido = 0
  let qtd = 0
  const porCliente = new Map<string, { valor: number; qtd: number }>()
  const porEmpresa = new Map<number, number>()
  const porTipo = new Map<string, number>()
  const proximos: Array<{ vencimento: string; cliente: string; valor: number; descricao: string; empresa: string }> = []

  for (const t of titulos) {
    if (empresas.length > 0 && !empresasSet.has(t.empresaCodigo)) continue
    // TITULO_RECEBER não tem valor pago parcial — em aberto = valor quando pendente.
    if (apenasPendente && !t.pendente) continue
    const aberto = t.pendente ? (t.valor ?? 0) : 0
    if (aberto <= 0) continue
    qtd += 1
    totalAberto += aberto
    const venc = (t.dataVencimento ?? '').slice(0, 10)
    if (venc && venc < hoje) totalVencido += aberto
    const cli = t.nomeCliente || `Cliente ${t.clienteCodigo}`
    const cc = porCliente.get(cli) ?? { valor: 0, qtd: 0 }
    cc.valor += aberto
    cc.qtd += 1
    porCliente.set(cli, cc)
    porEmpresa.set(t.empresaCodigo, (porEmpresa.get(t.empresaCodigo) ?? 0) + aberto)
    const tipo = t.tipo || 'Sem classificação'
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + aberto)
    proximos.push({
      vencimento: venc,
      cliente: cli,
      valor: Number(aberto.toFixed(2)),
      descricao: t.documento || (t.tituloNumero ? String(t.tituloNumero) : ''),
      empresa: empresaMap.get(t.empresaCodigo) ?? `Empresa ${t.empresaCodigo}`,
    })
  }

  const clientesTop = Array.from(porCliente.entries())
    .map(([nome, v]) => ({ cliente: nome, valor: Number(v.valor.toFixed(2)), valor_brl: `R$ ${fmt(v.valor)}`, titulos: v.qtd }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 15)
  const empresasBreakdown = Array.from(porEmpresa.entries())
    .map(([cod, v]) => ({ empresaNome: empresaMap.get(cod) ?? `Empresa ${cod}`, valor: Number(v.toFixed(2)), valor_brl: `R$ ${fmt(v)}` }))
    .sort((a, b) => b.valor - a.valor)
  const tipoBreakdown = Array.from(porTipo.entries())
    .map(([nome, v]) => ({ categoria: nome, valor: Number(v.toFixed(2)), valor_brl: `R$ ${fmt(v)}` }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 15)
  const proximosVenc = proximos.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 20)

  return {
    referencia: { data_inicial: dataInicial, ate_data: dataFinal, apenas_pendentes: apenasPendente, hoje },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    total_a_receber: Number(totalAberto.toFixed(2)),
    total_a_receber_brl: `R$ ${fmt(totalAberto)}`,
    total_vencido_brl: `R$ ${fmt(totalVencido)}`,
    total_a_vencer_brl: `R$ ${fmt(totalAberto - totalVencido)}`,
    quantidade_titulos: qtd,
    por_cliente: clientesTop,
    por_empresa: empresasBreakdown,
    por_tipo: tipoBreakdown,
    proximos_vencimentos: proximosVenc,
  }
}

/* ─── Tool 10: fluxo de caixa (financeiro / MOVIMENTO_CONTA — só leitura) ─── */

const getFluxoCaixa = async (
  ctx: ToolContext,
  input: { dataInicial?: string; dataFinal?: string; empresaCodigo?: number[] },
) => {
  const empresas = resolveEmpresas(ctx, input.empresaCodigo)
  const empresasSet = new Set(empresas)
  const empresaMap = await getEmpresaMap()
  const dataInicial = input.dataInicial ?? ctx.dataInicial
  const dataFinal = input.dataFinal ?? ctx.dataFinal

  const empresasToQuery: Array<number | undefined> = empresas.length > 0 ? empresas : [undefined]
  const movArrays = await Promise.all(
    empresasToQuery.map((empCod) =>
      fetchAllPages<Awaited<ReturnType<typeof fetchMovimentosConta>>['resultados'][number]>(
        ({ ultimoCodigo, limite }) =>
          fetchMovimentosConta({ empresaCodigo: empCod, dataInicial, dataFinal, mostraSaldo: true, ultimoCodigo, limite }),
        1000,
        30,
      ),
    ),
  )
  const movs = movArrays.flat()

  let entradas = 0
  let saidas = 0
  let qtd = 0
  const porTipo = new Map<string, number>()
  const porEvento = new Map<string, number>()
  const porEmpresa = new Map<number, number>()
  const porDia = new Map<string, { entrada: number; saida: number }>()

  for (const m of movs) {
    if (empresas.length > 0 && !empresasSet.has(m.empresaCodigo)) continue
    // Convenção de ledger: valor > 0 = entrada (crédito), < 0 = saída (débito).
    const v = m.valor ?? 0
    qtd += 1
    if (v >= 0) entradas += v
    else saidas += -v
    porEmpresa.set(m.empresaCodigo, (porEmpresa.get(m.empresaCodigo) ?? 0) + v)
    const tipo = m.tipo || 'Outros'
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + v)
    const ev = m.evento || m.descricao || 'Outros'
    porEvento.set(ev, (porEvento.get(ev) ?? 0) + v)
    const dia = (m.dataMovimento ?? '').slice(0, 10)
    if (dia) {
      const pd = porDia.get(dia) ?? { entrada: 0, saida: 0 }
      if (v >= 0) pd.entrada += v
      else pd.saida += -v
      porDia.set(dia, pd)
    }
  }

  const liquido = entradas - saidas
  const serieDiaria = Array.from(porDia.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dia, v]) => ({
      data: dia,
      entradas: Number(v.entrada.toFixed(2)),
      saidas: Number(v.saida.toFixed(2)),
      liquido: Number((v.entrada - v.saida).toFixed(2)),
    }))
  const tipoBreakdown = Array.from(porTipo.entries())
    .map(([nome, v]) => ({ tipo: nome, valor: Number(v.toFixed(2)), valor_brl: `R$ ${fmt(v)}` }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
    .slice(0, 15)
  const eventoBreakdown = Array.from(porEvento.entries())
    .map(([nome, v]) => ({ evento: nome, valor: Number(v.toFixed(2)), valor_brl: `R$ ${fmt(v)}` }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
    .slice(0, 15)
  const empresaBreakdown = Array.from(porEmpresa.entries())
    .map(([cod, v]) => ({ empresaNome: empresaMap.get(cod) ?? `Empresa ${cod}`, fluxo_liquido: Number(v.toFixed(2)), fluxo_liquido_brl: `R$ ${fmt(v)}` }))
    .sort((a, b) => b.fluxo_liquido - a.fluxo_liquido)

  return {
    referencia: { data_inicial: dataInicial, data_final: dataFinal },
    empresas_consultadas: empresas.length === 0 ? 'todas' : empresas,
    total_entradas: Number(entradas.toFixed(2)),
    total_entradas_brl: `R$ ${fmt(entradas)}`,
    total_saidas: Number(saidas.toFixed(2)),
    total_saidas_brl: `R$ ${fmt(saidas)}`,
    fluxo_liquido: Number(liquido.toFixed(2)),
    fluxo_liquido_brl: `R$ ${fmt(liquido)}`,
    quantidade_movimentos: qtd,
    por_tipo: tipoBreakdown,
    por_evento: eventoBreakdown,
    por_empresa: empresaBreakdown,
    serie_diaria: serieDiaria,
    nota: 'Fluxo de caixa REALIZADO (movimentos das contas no período). Entradas = créditos, saídas = débitos. Para projeção futura use get_contas_receber (a receber) e get_contas_pagar (a pagar).',
  }
}

export const TOOL_DEFINITIONS: ClaudeToolDefinition[] = [
  {
    name: 'get_faturamento_periodo',
    description:
      'Retorna o faturamento total de vendas em um período, com quebra por DIA, por MODELO de documento, e por EMPRESA (posto). Use pra perguntas tipo "qual o faturamento desta semana?", "qual posto faturou mais?", "compare os postos". IMPORTANTE: a resposta já contém o breakdown `por_empresa` ordenado do maior pro menor — NÃO precisa chamar a tool várias vezes pra comparar postos, basta uma chamada sem empresaCodigo (ou com a lista de todos os postos). Se o usuário não especificar datas, omita os parâmetros — o sistema usa o período atualmente selecionado nos filtros globais.',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Data início no formato yyyy-MM-dd. Opcional — default usa o filtro global.' },
        dataFinal: { type: 'string', description: 'Data fim no formato yyyy-MM-dd. Opcional — default usa o filtro global.' },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa o filtro global. Use a tool get_empresas pra descobrir os códigos.',
        },
      },
    },
  },
  {
    name: 'get_volume_combustivel',
    description:
      'Retorna litros vendidos e faturamento por tipo de COMBUSTÍVEL e também por EMPRESA (posto) em um período. Use pra perguntas como "quantos litros de gasolina foram vendidos", "qual combustível mais vendeu", "qual posto vendeu mais diesel". A resposta tem `por_combustivel` e `por_empresa` em uma única chamada — NÃO precisa loopar por posto. Filtra opcionalmente por nome do combustível (busca parcial).',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Data início yyyy-MM-dd. Opcional.' },
        dataFinal: { type: 'string', description: 'Data fim yyyy-MM-dd. Opcional.' },
        combustivelNome: {
          type: 'string',
          description: 'Nome (ou parte do nome) do combustível pra filtrar. Ex: "diesel s10", "gasolina", "etanol". Omita pra ver todos.',
        },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa o filtro global.',
        },
      },
    },
  },
  {
    name: 'get_top_produtos',
    description:
      'Retorna os produtos mais vendidos por faturamento em um período, JÁ COM o código interno do produto (`produto_codigo`) e o(s) código(s) de barras / EAN (`codigo_barras` = principal, `codigos_barras` = todos). Pode filtrar por categoria (combustivel ou conveniencia) e por empresa. Use pra "produtos mais vendidos da conveniência", "top 5 produtos da loja", e também pra "qual o código de barras do produto/lubrificante mais vendido" — o EAN vem no resultado. Se `codigo_barras` for null, o produto não tem EAN cadastrado (use o `produto_codigo`).',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Data início yyyy-MM-dd. Opcional.' },
        dataFinal: { type: 'string', description: 'Data fim yyyy-MM-dd. Opcional.' },
        limite: { type: 'number', description: 'Quantos itens retornar (max 25). Default 10.' },
        categoria: {
          type: 'string',
          enum: ['combustivel', 'conveniencia'],
          description: 'Filtra pra mostrar só combustíveis OU só conveniência. Omita pra ver tudo.',
        },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa o filtro global.',
        },
      },
    },
  },
  {
    name: 'get_top_frentistas',
    description:
      'Retorna os frentistas que mais venderam em um período, ordenados por litros ou faturamento. A resposta inclui o NOME DO POSTO (empresaNome) de cada frentista — útil pra perguntas cross-posto. Use pra "qual frentista vendeu mais", "ranking de frentistas", "qual frentista do Posto X foi destaque".',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Data início yyyy-MM-dd. Opcional.' },
        dataFinal: { type: 'string', description: 'Data fim yyyy-MM-dd. Opcional.' },
        metrica: {
          type: 'string',
          enum: ['litros', 'faturamento'],
          description: 'Métrica de ordenação. Default "litros".',
        },
        limite: { type: 'number', description: 'Quantos retornar (max 20). Default 10.' },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa o filtro global.',
        },
      },
    },
  },
  {
    name: 'get_ultima_compra_combustivel',
    description:
      'Retorna a ÚLTIMA COMPRA (entrada de combustível do fornecedor) por posto — quando chegou, quanto litros, custo unitário, valor total da nota fiscal. Use pra "qual o valor da última compra de gasolina?", "quando foi a última entrega de diesel?", "preço da última compra de etanol por posto". NÃO confundir com VENDAS — esta tool é sobre o que o posto COMPROU do fornecedor (entrada no tanque via /LMC). Janela default 90 dias.',
    input_schema: {
      type: 'object',
      properties: {
        combustivelNome: {
          type: 'string',
          description: 'Nome (ou parte) do combustível. Ex: "gasolina comum", "diesel s10", "etanol". Omita pra ver todos.',
        },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de empresas pra filtrar. Opcional.',
        },
        diasAtras: {
          type: 'number',
          description: 'Janela de busca em dias contados de hoje pra trás. Default 90 dias, máx 365.',
        },
      },
    },
  },
  {
    name: 'get_lucro_combustivel',
    description:
      'Retorna LUCRO BRUTO e MARGEM por COMBUSTÍVEL e por EMPRESA (posto) em um período. Lucro bruto = faturamento das vendas − custo apurado (preço de custo gravado por abastecimento na apuração — mesma base da tela Combustível). É a tool certa pra "qual o lucro bruto?", "qual a margem da gasolina?", "qual posto teve melhor margem?", "lucro por combustível". Pra comparar com outro período (ex.: mesmo mês do ano anterior), CHAME a tool duas vezes com as datas de cada período e compare os resultados. ATENÇÃO: confira o campo cobertura_custo_pct na resposta — se for baixo, o período pode não ter sido reapurado e o lucro fica superestimado; avise o usuário.',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Data início yyyy-MM-dd. Opcional — default usa o filtro global.' },
        dataFinal: { type: 'string', description: 'Data fim yyyy-MM-dd. Opcional — default usa o filtro global.' },
        combustivelNome: {
          type: 'string',
          description: 'Nome (ou parte) do combustível pra filtrar. Ex: "gasolina", "diesel s10", "etanol". Omita pra ver todos.',
        },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa todos os postos do usuário.',
        },
      },
    },
  },
  {
    name: 'get_contas_pagar',
    description:
      'Retorna as CONTAS A PAGAR (financeiro) — títulos a pagar a fornecedores/tributos, com total em aberto, total vencido vs a vencer, quebra por fornecedor, por posto e por categoria (plano de conta), e a lista dos próximos vencimentos. Use pra "quais minhas contas a pagar?", "quanto tenho a pagar este mês?", "quanto está vencido?", "quanto devo pro fornecedor X?", "contas a pagar até hoje". Por padrão traz só os títulos PENDENTES (em aberto) e com vencimento ATÉ HOJE; passe dataFinal pra mudar o corte de vencimento, dataInicial pra limitar o início da janela, ou apenasPendente=false pra incluir os já pagos. É só LEITURA do financeiro do ERP.',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Vencimento inicial yyyy-MM-dd. Opcional — omita pra incluir tudo até a data de corte (inclui vencidos antigos).' },
        dataFinal: { type: 'string', description: 'Vencimento até esta data yyyy-MM-dd. Opcional — default é HOJE ("até a data atual"). Use o fim do mês pra "contas do mês".' },
        apenasPendente: { type: 'boolean', description: 'Só títulos em aberto (não pagos). Default true. Use false pra incluir os já pagos no período.' },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa todos os postos do usuário.',
        },
      },
    },
  },
  {
    name: 'get_contas_receber',
    description:
      'Retorna as CONTAS A RECEBER (financeiro) — títulos a receber de clientes (vendas a prazo, crediário, cheques etc.), com total em aberto, total vencido vs a vencer, quebra por cliente, por posto e por tipo, e a lista dos próximos vencimentos. Use pra "quais minhas contas a receber?", "quanto tenho a receber?", "quanto está vencido pra receber?", "quanto o cliente X me deve?", "recebíveis do mês". Por padrão traz só os títulos PENDENTES (em aberto); passe dataInicial/dataFinal pra ajustar a janela de vencimento (default ±1 ano) ou apenasPendente=false pra incluir os já recebidos. É só LEITURA do financeiro do ERP.',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Vencimento inicial yyyy-MM-dd. Opcional — default 1 ano atrás (inclui vencidos antigos).' },
        dataFinal: { type: 'string', description: 'Vencimento até esta data yyyy-MM-dd. Opcional — default 1 ano à frente. Use o fim do mês pra "recebíveis do mês".' },
        apenasPendente: { type: 'boolean', description: 'Só títulos em aberto (não recebidos). Default true. Use false pra incluir os já recebidos no período.' },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa todos os postos do usuário.',
        },
      },
    },
  },
  {
    name: 'get_fluxo_caixa',
    description:
      'Retorna o FLUXO DE CAIXA REALIZADO (financeiro / movimentos das contas) no período — total de entradas (créditos), saídas (débitos), fluxo líquido, quebra por tipo, por evento/categoria e por posto, e a série diária (entradas/saídas/líquido por dia). Use pra "gere/mostre o fluxo de caixa", "quanto entrou e saiu no mês", "fluxo de caixa do posto X", "saldo de caixa do período". É só LEITURA — fluxo REALIZADO; para projeção futura combine com get_contas_receber e get_contas_pagar. Default = período do mês corrente.',
    input_schema: {
      type: 'object',
      properties: {
        dataInicial: { type: 'string', description: 'Data inicial yyyy-MM-dd. Opcional — default início do mês corrente.' },
        dataFinal: { type: 'string', description: 'Data final yyyy-MM-dd. Opcional — default fim do mês corrente.' },
        empresaCodigo: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lista de códigos de empresa pra filtrar. Opcional — default usa todos os postos do usuário.',
        },
      },
    },
  },
  {
    name: 'get_empresas',
    description:
      'Lista todas as empresas (postos) cadastradas no sistema com seus códigos. Use quando o usuário mencionar um posto pelo nome e você precisar do código pra usar nas outras tools.',
    input_schema: { type: 'object', properties: {} },
  },
]

/* ─── Executor ─── */

export const executeTool = async (
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> => {
  switch (name) {
    case 'get_faturamento_periodo':
      return getFaturamentoPeriodo(ctx, input as Parameters<typeof getFaturamentoPeriodo>[1])
    case 'get_volume_combustivel':
      return getVolumeCombustivel(ctx, input as Parameters<typeof getVolumeCombustivel>[1])
    case 'get_top_produtos':
      return getTopProdutos(ctx, input as Parameters<typeof getTopProdutos>[1])
    case 'get_top_frentistas':
      return getTopFrentistas(ctx, input as Parameters<typeof getTopFrentistas>[1])
    case 'get_ultima_compra_combustivel':
      return getUltimaCompraCombustivel(ctx, input as Parameters<typeof getUltimaCompraCombustivel>[1])
    case 'get_lucro_combustivel':
      return getLucroCombustivel(ctx, input as Parameters<typeof getLucroCombustivel>[1])
    case 'get_contas_pagar':
      return getContasPagar(ctx, input as Parameters<typeof getContasPagar>[1])
    case 'get_contas_receber':
      return getContasReceber(ctx, input as Parameters<typeof getContasReceber>[1])
    case 'get_fluxo_caixa':
      return getFluxoCaixa(ctx, input as Parameters<typeof getFluxoCaixa>[1])
    case 'get_empresas':
      return getEmpresas()
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`)
  }
}
