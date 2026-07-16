// ============================================================================
// Apuração — funções de CÁLCULO (port fiel de src/api/supabase/apuracao.ts).
// Transforms PUROS: sem browser, sem axios, sem supabase-js. Mantém os mesmos
// resultados da apuração manual do front (qualquer divergência aqui faz o cron
// gravar um cache diferente do botão "Apurar"). Não editar sem espelhar no front.
// ============================================================================

// ── Tipos de entrada (raw Quality) — só os campos que o cálculo acessa ──
export interface Abastecimento {
  codigo: number
  dataFiscal: string
  codigoProduto: number
  quantidade: number
  valorUnitario: number
  valorTotal: number
  codigoFrentista: number
  codigoBico: number
  empresaCodigo: number
  dataHoraAbastecimento: string
  placa: string
  abastecimentoCodigo: number
  /** Teste de bomba — não é venda; excluído da apuração. */
  afericao?: boolean
  precoCusto?: number
  /** Preço de TABELA carimbado no abastecimento — base do desvio de Gestão de Preços. */
  precoCadastro?: number
  tabelaPrecoA?: number
  tabelaPrecoB?: number
  tabelaPrecoC?: number
}

export interface LMC {
  empresaCodigo: number
  produtoCodigo: number[]
  dataMovimento: string
  precoCusto: number
  produtoLmcCodigo: number
}

export interface Produto {
  codigo: number
  produtoCodigo: number
  nome: string
  produtoLmcCodigo: number
  grupoCodigo: number
  tipoProduto: string // 'C' = combustível
}

export interface Grupo {
  grupoCodigo: number
  nome: string
  tipoGrupo: string // 'Pista' | 'Conveniência' | ...
}

export interface VendaItem {
  empresaCodigo: number
  vendaCodigo: number
  dataMovimento: string
  produtoCodigo: number
  quantidade: number
  precoCusto: number
  totalCusto: number
  totalVenda: number
  totalDesconto: number
  totalAcrescimo: number
  cancelada?: string
  funcionarioCodigo: number
}

export interface VendaFormaPagamento {
  empresaCodigo: number
  vendaCodigo: number
  vendaPrazoCodigo: number
  dataMovimento: string
  vencimento: string
  valorPagamento: number
  taxaPercentual: number
  formaPagamentoCodigo: number
  administradoraCodigo: number
  turnoCodigo: number
  tipoFormaPagamento: string
  nomeFormaPagamento: string
}

export interface VendaResumo {
  codigoEmpresa: number
  data: string
  quantidade: number
  total: number
}

export interface Caixa {
  empresaCodigo: number
  caixaCodigo: number
  dataMovimento: string
  turnoCodigo: number
  turno: string
  pdvCodigo: number
  funcionarioCodigo: number
  centroCusto: number
  abertura: string
  fechamento: string
  fechado: boolean
  consolidado: boolean
  tipoInclusao: string
  bloqueado: boolean
  tipoBloqueio: string
  apurado: number
  diferenca: number
}

// ── Tipos de saída (snake_case, batem com as colunas do Supabase) ──
export type SetorVenda = 'combustivel' | 'automotivos' | 'conveniencia' | 'outros'
export interface ProdutoInfo { setor: SetorVenda; nome: string; grupo?: string }

export interface ApuracaoDiariaUpsert {
  rede_id: string; empresa_codigo: number; data: string
  fuel_litros: number; fuel_faturamento: number; fuel_custo: number
  fuel_lucro_bruto: number; fuel_abast_count: number
  vendas_total: number; vendas_qtd: number
}

export interface ApuracaoFuelProdutoUpsert {
  rede_id: string; empresa_codigo: number; data: string
  produto_codigo: number; produto_nome: string | null
  litros: number; faturamento: number; custo: number; lucro_bruto: number; abast_count: number
}

export interface AbastecimentoCacheUpsert {
  rede_id: string; empresa_codigo: number; abastecimento_codigo: number
  data_fiscal: string | null; data_hora_abastecimento: string | null
  codigo_produto: number | null; codigo_frentista: number | null; codigo_bico: number | null
  quantidade: number; valor_unitario: number; valor_total: number
  placa: string | null; preco_custo: number | null
  preco_cadastro: number | null
  tabela_preco_a: number | null; tabela_preco_b: number | null; tabela_preco_c: number | null
}

export interface CaixaCacheUpsert {
  rede_id: string; empresa_codigo: number; caixa_codigo: number; turno_codigo: number
  data_movimento: string; turno: string | null; pdv_codigo: number | null
  funcionario_codigo: number | null; centro_custo: number | null
  abertura: string | null; fechamento: string | null
  fechado: boolean; consolidado: boolean; bloqueado: boolean
  tipo_bloqueio: string | null; tipo_inclusao: string | null
  apurado: number; diferenca: number
}

export interface FormaPagamentoCacheUpsert {
  rede_id: string; empresa_codigo: number; venda_codigo: number; venda_prazo_codigo: number
  data_movimento: string | null; vencimento: string | null
  forma_pagamento_codigo: number | null; tipo_forma_pagamento: string | null
  nome_forma_pagamento: string | null; administradora_codigo: number | null
  turno_codigo: number | null; valor_pagamento: number; taxa_percentual: number
}

export interface ApuracaoVendaUpsert {
  rede_id: string; empresa_codigo: number; data: string; produto_codigo: number
  setor: string; produto_nome: string
  quantidade: number; total_venda: number; total_custo: number
  acrescimos: number; descontos: number; linhas: number
  cupons: number; cupons_grupo: number; cupons_produto: number
}

export interface ApuracaoVendaFuncionarioUpsert {
  rede_id: string; empresa_codigo: number; data: string; funcionario_codigo: number
  setor: string; faturamento: number; custo: number; quantidade: number
  acrescimos: number; descontos: number; linhas: number; cupons: number
}

interface ComputeRowsInput {
  redeId: string; empresaCodigos: number[]; dataInicial: string; dataFinal: string
  abastecimentos: Abastecimento[]; lmc: LMC[]; vendaResumo: VendaResumo[]; produtos?: Produto[]
}
interface ComputeFuelProdutoInput {
  redeId: string; dataInicial: string; dataFinal: string
  abastecimentos: Abastecimento[]; lmc: LMC[]; produtos?: Produto[]
  vendaItens?: VendaItem[]; autorizados?: Set<number>
}

// ── enumerateDays (TZ-safe via UTC — itera dia a dia entre 2 yyyy-MM-dd) ──
export const enumerateDays = (dataInicial: string, dataFinal: string): string[] => {
  const days: string[] = []
  const [y, m, d] = dataInicial.split('-').map(Number)
  if (!y || !m || !d) return days
  let cur = new Date(Date.UTC(y, m - 1, d))
  while (true) {
    const s = cur.toISOString().slice(0, 10)
    if (s > dataFinal) break
    days.push(s)
    cur = new Date(cur.getTime() + 86400000)
  }
  return days
}

// ── alias map: liga os códigos do MESMO produto (produtoCodigo/lmc/codigo) ──
export const buildAliasMap = (produtos: Produto[]): Map<number, number[]> => {
  const aliases = new Map<number, number[]>()
  for (const p of produtos) {
    const codes = [p.produtoCodigo, p.produtoLmcCodigo, p.codigo].filter(
      (c): c is number => typeof c === 'number' && c > 0,
    )
    const uniq = [...new Set(codes)]
    for (const c of codes) aliases.set(c, uniq)
  }
  return aliases
}

// ── cost map (empresa-produto → precoCusto mais recente do LMC, alias-expandido) ──
export const buildCostMapFromLmc = (lmc: LMC[], produtos?: Produto[]): Map<string, number> => {
  const aliasMap = produtos && produtos.length > 0 ? buildAliasMap(produtos) : null
  const costMap = new Map<string, number>()
  const sortedLmc = [...lmc].sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento))
  for (const l of sortedLmc) {
    if (l.precoCusto <= 0) continue
    for (const prodCode of l.produtoCodigo) {
      const codes = aliasMap?.get(prodCode) ?? [prodCode]
      for (const c of codes) {
        const key = `${l.empresaCodigo}-${c}`
        if (!costMap.has(key)) costMap.set(key, l.precoCusto)
      }
    }
  }
  return costMap
}

// ── CMV (custo médio/litro) a partir dos itens de venda, alias-expandido ──
const buildCmvMapFromVendaItens = (
  vendaItens: VendaItem[], produtos?: Produto[], autorizados?: Set<number>,
): Map<number, number> => {
  const aliasMap = produtos && produtos.length > 0 ? buildAliasMap(produtos) : null
  const agg = new Map<number, { qty: number; custo: number }>()
  for (const it of vendaItens) {
    if (autorizados ? !autorizados.has(it.vendaCodigo) : it.cancelada === 'S') continue
    if (it.quantidade <= 0) continue
    const cur = agg.get(it.produtoCodigo) ?? { qty: 0, custo: 0 }
    cur.qty += it.quantidade
    cur.custo += it.totalCusto > 0 ? it.totalCusto : it.precoCusto * it.quantidade
    agg.set(it.produtoCodigo, cur)
  }
  const map = new Map<number, number>()
  for (const [prod, v] of agg) {
    const custoUnit = v.qty > 0 ? v.custo / v.qty : 0
    if (custoUnit <= 0) continue
    const keys = aliasMap?.get(prod) ?? [prod]
    for (const k of keys) if (!map.has(k)) map.set(k, custoUnit)
  }
  return map
}

// ── classificação de setor (port de Apuracao.tsx) → ProdutoInfo por produto ──
export const buildProdutoInfo = (produtos: Produto[], grupos: Grupo[]): Map<number, ProdutoInfo> => {
  const grupoTipo = new Map(grupos.map((g) => [g.grupoCodigo, g.tipoGrupo]))
  const grupoNome = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))
  const info = new Map<number, ProdutoInfo>()
  for (const p of produtos) {
    const tipoGrupo = grupoTipo.get(p.grupoCodigo) ?? ''
    const setor: SetorVenda =
      p.tipoProduto === 'C' ? 'combustivel'
        : tipoGrupo === 'Pista' ? 'automotivos'
          : tipoGrupo === 'Conveniência' ? 'conveniencia'
            : 'outros'
    info.set(p.produtoCodigo, { setor, nome: p.nome, grupo: grupoNome.get(p.grupoCodigo) ?? 'Sem grupo' })
  }
  return info
}

// ── apuracao_diaria (1 row por empresa×dia) ──
export const computeApuracaoRows = (input: ComputeRowsInput): ApuracaoDiariaUpsert[] => {
  const costMap = buildCostMapFromLmc(input.lmc, input.produtos)
  interface FuelAgg { litros: number; fat: number; custo: number; count: number }
  const fuelByKey = new Map<string, FuelAgg>()
  for (const a of input.abastecimentos) {
    const day = (a.dataFiscal || a.dataHoraAbastecimento?.slice(0, 10) || '').slice(0, 10)
    if (!day || day < input.dataInicial || day > input.dataFinal) continue
    const prodCode = Number(a.codigoProduto)
    if (prodCode <= 0) continue
    const cost = costMap.get(`${a.empresaCodigo}-${prodCode}`) ?? 0
    const key = `${a.empresaCodigo}|${day}`
    const prev = fuelByKey.get(key) ?? { litros: 0, fat: 0, custo: 0, count: 0 }
    fuelByKey.set(key, {
      litros: prev.litros + a.quantidade,
      fat: prev.fat + a.valorTotal,
      custo: prev.custo + cost * a.quantidade,
      count: prev.count + 1,
    })
  }
  interface VendaAgg { total: number; qtd: number }
  const vendaByKey = new Map<string, VendaAgg>()
  for (const r of input.vendaResumo) {
    const day = r.data.slice(0, 10)
    if (!day || day < input.dataInicial || day > input.dataFinal) continue
    const key = `${r.codigoEmpresa}|${day}`
    const prev = vendaByKey.get(key) ?? { total: 0, qtd: 0 }
    vendaByKey.set(key, { total: prev.total + r.total, qtd: prev.qtd + r.quantidade })
  }
  const days = enumerateDays(input.dataInicial, input.dataFinal)
  const rows: ApuracaoDiariaUpsert[] = []
  for (const empCodigo of input.empresaCodigos) {
    for (const day of days) {
      const key = `${empCodigo}|${day}`
      const fuel = fuelByKey.get(key) ?? { litros: 0, fat: 0, custo: 0, count: 0 }
      const vendas = vendaByKey.get(key) ?? { total: 0, qtd: 0 }
      rows.push({
        rede_id: input.redeId,
        empresa_codigo: empCodigo,
        data: day,
        fuel_litros: Number(fuel.litros.toFixed(3)),
        fuel_faturamento: Number(fuel.fat.toFixed(2)),
        fuel_custo: Number(fuel.custo.toFixed(2)),
        fuel_lucro_bruto: Number((fuel.fat - fuel.custo).toFixed(2)),
        fuel_abast_count: fuel.count,
        vendas_total: Number(vendas.total.toFixed(2)),
        vendas_qtd: Math.round(vendas.qtd),
      })
    }
  }
  return rows
}

// ── apuracao_fuel_diaria (por empresa×dia×produto, custo CMV>LMC>0) ──
export const computeFuelProdutoRows = (input: ComputeFuelProdutoInput): ApuracaoFuelProdutoUpsert[] => {
  const lmcCost = buildCostMapFromLmc(input.lmc, input.produtos)
  const cmv = buildCmvMapFromVendaItens(input.vendaItens ?? [], input.produtos, input.autorizados)
  const nomePorProduto = new Map<number, string>()
  for (const p of input.produtos ?? []) {
    for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
      if (typeof c === 'number' && c > 0 && !nomePorProduto.has(c)) nomePorProduto.set(c, p.nome)
    }
  }
  interface Agg { empresa: number; data: string; produto: number; litros: number; fat: number; custo: number; count: number }
  const byKey = new Map<string, Agg>()
  for (const a of input.abastecimentos) {
    const day = (a.dataFiscal || a.dataHoraAbastecimento?.slice(0, 10) || '').slice(0, 10)
    if (!day || day < input.dataInicial || day > input.dataFinal) continue
    const prod = Number(a.codigoProduto)
    if (prod <= 0) continue
    const unit = cmv.get(prod) ?? lmcCost.get(`${a.empresaCodigo}-${prod}`) ?? 0
    const key = `${a.empresaCodigo}|${day}|${prod}`
    const cur = byKey.get(key) ?? { empresa: a.empresaCodigo, data: day, produto: prod, litros: 0, fat: 0, custo: 0, count: 0 }
    cur.litros += a.quantidade
    cur.fat += a.valorTotal
    cur.custo += unit * a.quantidade
    cur.count += 1
    byKey.set(key, cur)
  }
  return Array.from(byKey.values()).map((v) => ({
    rede_id: input.redeId,
    empresa_codigo: v.empresa,
    data: v.data,
    produto_codigo: v.produto,
    produto_nome: nomePorProduto.get(v.produto) ?? null,
    litros: Number(v.litros.toFixed(3)),
    faturamento: Number(v.fat.toFixed(2)),
    custo: Number(v.custo.toFixed(2)),
    lucro_bruto: Number((v.fat - v.custo).toFixed(2)),
    abast_count: v.count,
  }))
}

// ── apuracao_vendas + apuracao_vendas_funcionario (dupla passagem) ──
export const aggregateVendaCache = (
  itens: VendaItem[], redeId: string, produtoInfo: Map<number, ProdutoInfo>, autorizados?: Set<number>,
): { vendaRows: ApuracaoVendaUpsert[]; funcRows: ApuracaoVendaFuncionarioUpsert[] } => {
  const aut = (it: VendaItem) => (autorizados ? autorizados.has(it.vendaCodigo) : it.cancelada !== 'S')
  const setorSets = new Map<string, Set<number>>()
  const grupoSets = new Map<string, Set<number>>()
  const produtoSets = new Map<string, Set<number>>()
  const funcSets = new Map<string, Set<number>>()
  const add = (m: Map<string, Set<number>>, k: string, v: number) => {
    let s = m.get(k); if (!s) { s = new Set(); m.set(k, s) }
    s.add(v)
  }
  for (const it of itens) {
    if (!aut(it)) continue
    const info = produtoInfo.get(it.produtoCodigo)
    const setor = info?.setor
    if (!setor || setor === 'outros') continue
    const data = it.dataMovimento ? it.dataMovimento.slice(0, 10) : ''
    if (!data || it.vendaCodigo == null) continue
    add(setorSets, `${it.empresaCodigo}|${data}|${setor}`, it.vendaCodigo)
    if (setor !== 'combustivel') {
      add(grupoSets, `${it.empresaCodigo}|${data}|${info?.grupo || 'Sem grupo'}`, it.vendaCodigo)
      add(produtoSets, `${it.empresaCodigo}|${data}|${it.produtoCodigo}`, it.vendaCodigo)
      if (it.funcionarioCodigo) add(funcSets, `${it.empresaCodigo}|${data}|${it.funcionarioCodigo}|${setor}`, it.vendaCodigo)
    }
  }
  const cuponsByDay = new Map<string, number>()
  for (const [k, s] of setorSets) cuponsByDay.set(k, s.size)

  const vmap = new Map<string, ApuracaoVendaUpsert>()
  const fmap = new Map<string, ApuracaoVendaFuncionarioUpsert>()
  for (const it of itens) {
    if (!aut(it)) continue
    const data = it.dataMovimento ? it.dataMovimento.slice(0, 10) : ''
    if (!data) continue
    const info = produtoInfo.get(it.produtoCodigo)
    const setor: SetorVenda = info?.setor ?? 'conveniencia'
    if (setor === 'outros') continue
    // Custo = `totalCusto` do item (o custo que o ERP gravou na venda), com
    // fallback em precoCusto×qty quando o item não tem totalCusto. Combustível
    // seguia SÓ precoCusto×qty e divergia ~0,03% do CMV do WebPosto; alinhado
    // aos demais setores (e ao helper de CMV) pra o resultado bater com o WebPosto.
    const custo = (it.totalCusto ?? 0) > 0
      ? (it.totalCusto ?? 0)
      : (it.precoCusto ?? 0) * (it.quantidade ?? 0)
    const vkey = `${it.empresaCodigo}|${data}|${it.produtoCodigo}`
    const ev = vmap.get(vkey)
    if (ev) {
      ev.quantidade += it.quantidade ?? 0
      ev.total_venda += it.totalVenda ?? 0
      ev.total_custo += custo
      ev.acrescimos += it.totalAcrescimo ?? 0
      ev.descontos += it.totalDesconto ?? 0
      ev.linhas += 1
    } else {
      vmap.set(vkey, {
        rede_id: redeId,
        empresa_codigo: it.empresaCodigo,
        data,
        produto_codigo: it.produtoCodigo,
        setor,
        produto_nome: info?.nome ?? `Produto ${it.produtoCodigo}`,
        quantidade: it.quantidade ?? 0,
        total_venda: it.totalVenda ?? 0,
        total_custo: custo,
        acrescimos: it.totalAcrescimo ?? 0,
        descontos: it.totalDesconto ?? 0,
        linhas: 1,
        cupons: cuponsByDay.get(`${it.empresaCodigo}|${data}|${setor}`) ?? 0,
        cupons_grupo: setor === 'combustivel' ? 0 : (grupoSets.get(`${it.empresaCodigo}|${data}|${info?.grupo || 'Sem grupo'}`)?.size ?? 0),
        cupons_produto: setor === 'combustivel' ? 0 : (produtoSets.get(`${it.empresaCodigo}|${data}|${it.produtoCodigo}`)?.size ?? 0),
      })
    }
    if (setor !== 'combustivel' && it.funcionarioCodigo) {
      const fkey = `${it.empresaCodigo}|${data}|${it.funcionarioCodigo}|${setor}`
      const ef = fmap.get(fkey)
      if (ef) {
        ef.faturamento += it.totalVenda ?? 0
        ef.custo += it.totalCusto ?? 0
        ef.quantidade += it.quantidade ?? 0
        ef.acrescimos += it.totalAcrescimo ?? 0
        ef.descontos += it.totalDesconto ?? 0
        ef.linhas += 1
      } else {
        fmap.set(fkey, {
          rede_id: redeId,
          empresa_codigo: it.empresaCodigo,
          data,
          funcionario_codigo: it.funcionarioCodigo,
          setor,
          faturamento: it.totalVenda ?? 0,
          custo: it.totalCusto ?? 0,
          quantidade: it.quantidade ?? 0,
          acrescimos: it.totalAcrescimo ?? 0,
          descontos: it.totalDesconto ?? 0,
          linhas: 1,
          cupons: funcSets.get(fkey)?.size ?? 0,
        })
      }
    }
  }
  return { vendaRows: Array.from(vmap.values()), funcRows: Array.from(fmap.values()) }
}

// ── mappers raw → cache row ──
export const abastecimentoToCacheRow = (
  a: Abastecimento, redeId: string, costMap?: Map<string, number>,
): AbastecimentoCacheUpsert => ({
  rede_id: redeId,
  empresa_codigo: a.empresaCodigo,
  abastecimento_codigo: a.abastecimentoCodigo || a.codigo,
  data_fiscal: a.dataFiscal || null,
  data_hora_abastecimento: a.dataHoraAbastecimento || null,
  codigo_produto: a.codigoProduto || null,
  codigo_frentista: a.codigoFrentista || null,
  codigo_bico: a.codigoBico || null,
  quantidade: a.quantidade,
  valor_unitario: a.valorUnitario,
  valor_total: a.valorTotal,
  placa: a.placa || null,
  preco_custo: costMap?.get(`${a.empresaCodigo}-${a.codigoProduto}`) ?? null,
  preco_cadastro: a.precoCadastro ?? null,
  tabela_preco_a: a.tabelaPrecoA ?? null,
  tabela_preco_b: a.tabelaPrecoB ?? null,
  tabela_preco_c: a.tabelaPrecoC ?? null,
})

export const caixaToCacheRow = (c: Caixa, redeId: string): CaixaCacheUpsert => ({
  rede_id: redeId,
  empresa_codigo: c.empresaCodigo,
  caixa_codigo: c.caixaCodigo,
  turno_codigo: c.turnoCodigo,
  data_movimento: c.dataMovimento?.slice(0, 10) || '',
  turno: c.turno || null,
  pdv_codigo: c.pdvCodigo ?? null,
  funcionario_codigo: c.funcionarioCodigo ?? null,
  centro_custo: c.centroCusto ?? null,
  abertura: c.abertura || null,
  fechamento: c.fechamento || null,
  fechado: !!c.fechado,
  consolidado: !!c.consolidado,
  bloqueado: !!c.bloqueado,
  tipo_bloqueio: c.tipoBloqueio || null,
  tipo_inclusao: c.tipoInclusao || null,
  apurado: c.apurado ?? 0,
  diferenca: c.diferenca ?? 0,
})

export const formaPagamentoToCacheRow = (
  f: VendaFormaPagamento, redeId: string,
): FormaPagamentoCacheUpsert => ({
  rede_id: redeId,
  empresa_codigo: f.empresaCodigo,
  venda_codigo: f.vendaCodigo,
  venda_prazo_codigo: f.vendaPrazoCodigo ?? 0,
  data_movimento: f.dataMovimento ? f.dataMovimento.slice(0, 10) : null,
  vencimento: f.vencimento ? f.vencimento.slice(0, 10) : null,
  forma_pagamento_codigo: f.formaPagamentoCodigo ?? null,
  tipo_forma_pagamento: f.tipoFormaPagamento || null,
  nome_forma_pagamento: f.nomeFormaPagamento || null,
  administradora_codigo: f.administradoraCodigo ?? null,
  turno_codigo: f.turnoCodigo ?? null,
  valor_pagamento: f.valorPagamento ?? 0,
  taxa_percentual: f.taxaPercentual ?? 0,
})
