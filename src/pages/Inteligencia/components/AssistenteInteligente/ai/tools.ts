import { fetchVendaResumo, fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAbastecimentos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import type { Produto } from '@/api/types/produto'
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

/** Resolve nome legível pro produto. Cai pra alternativas quando `nome` é vazio. */
const produtoLabel = (p: Produto | undefined, codigo: number): string => {
  if (!p) return `Produto ${codigo} (não cadastrado)`
  const candidatos = [p.nome, p.descricaoFabricante, p.referenciaCodigo, p.produtoCodigoExterno]
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return `Produto ${codigo}`
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

  const por = new Map<number, { nome: string; qtd: number; faturamento: number; ehCombustivel: boolean }>()
  for (const i of itens) {
    // Filtro defensivo (em caso do fallback sem filtro ter retornado todas).
    if (empresas.length > 0 && !empresasSet.has(i.empresaCodigo)) continue
    const p = produtoMap.get(i.produtoCodigo)
    const ehComb = p?.combustivel === true
    if (input.categoria === 'combustivel' && !ehComb) continue
    if (input.categoria === 'conveniencia' && ehComb) continue
    const nome = produtoLabel(p, i.produtoCodigo)
    const cur = por.get(i.produtoCodigo) ?? { nome, qtd: 0, faturamento: 0, ehCombustivel: ehComb }
    cur.qtd += i.quantidade
    cur.faturamento += i.totalVenda
    por.set(i.produtoCodigo, cur)
  }

  const top = Array.from(por.values())
    .sort((a, b) => b.faturamento - a.faturamento)
    .slice(0, limite)
    .map((x) => ({
      produto: x.nome,
      categoria: x.ehCombustivel ? 'combustivel' : 'conveniencia',
      quantidade: Number(x.qtd.toFixed(3)),
      faturamento: Number(x.faturamento.toFixed(2)),
      faturamento_brl: `R$ ${fmt(x.faturamento)}`,
    }))

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

/* ─── Tool 6: lista de empresas (postos) — útil pra resolver "qual posto" ─── */

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
      'Retorna os produtos mais vendidos por faturamento em um período. Pode filtrar por categoria (combustivel ou conveniencia) e por empresa. Use pra perguntas tipo "produtos mais vendidos da conveniência", "top 5 produtos da loja", etc.',
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
    case 'get_empresas':
      return getEmpresas()
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`)
  }
}
