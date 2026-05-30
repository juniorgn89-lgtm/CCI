import { supabase } from '@/lib/supabase'
import type { Abastecimento, LMC } from '@/api/types/combustivel'
import type { Produto } from '@/api/types/produto'
import type { VendaResumo, VendaFormaPagamento, VendaItem } from '@/api/types/venda'
import type { Caixa } from '@/api/types/financeiro'

/**
 * Row do cache de apuração diária. 1 row por (rede, empresa, dia).
 * Mês corrente nunca entra no cache — sempre live na API Quality.
 * Veja docs/supabase-apuracao.sql para o schema completo.
 */
export interface ApuracaoDiariaRow {
  rede_id: string
  empresa_codigo: number
  data: string // yyyy-MM-dd
  fuel_litros: number
  fuel_faturamento: number
  fuel_custo: number
  fuel_lucro_bruto: number
  fuel_abast_count: number
  vendas_total: number
  vendas_qtd: number
  computed_at: string
  computed_by: string | null
}

/** Linha pronta pra UPSERT (sem campos de auditoria, que o banco preenche). */
export type ApuracaoDiariaUpsert = Omit<ApuracaoDiariaRow, 'computed_at' | 'computed_by'>

interface FetchParams {
  empresaCodigos: number[]
  dataInicial: string
  dataFinal: string
}

/**
 * Lê o cache do período. RLS já restringe à rede do usuário, mas o filtro
 * explícito por empresa garante que respeitamos `profiles.empresa_codigos`.
 */
export const fetchApuracaoDiaria = async (params: FetchParams): Promise<ApuracaoDiariaRow[]> => {
  if (!supabase) return []

  let query = supabase
    .from('apuracao_diaria')
    .select('*')
    .gte('data', params.dataInicial)
    .lte('data', params.dataFinal)

  if (params.empresaCodigos.length > 0) {
    query = query.in('empresa_codigo', params.empresaCodigos)
  }

  const { data, error } = await query
  if (error) {
    console.warn('[apuracao] fetch error:', error.message)
    return []
  }
  return (data ?? []) as ApuracaoDiariaRow[]
}

/**
 * UPSERT em lote (1 round-trip). Se a row já existe, sobrescreve com os novos
 * números — útil pra recalcular após correção retroativa na API Quality.
 * Quando `computedBy` é fornecido, marca quem rodou a apuração nas rows
 * gravadas (auditoria pra /admin/apuracao).
 */
export const upsertApuracaoDiaria = async (
  rows: ApuracaoDiariaUpsert[],
  computedBy?: string,
): Promise<void> => {
  if (!supabase || rows.length === 0) return
  const now = new Date().toISOString()
  const payload = rows.map((r) => ({
    ...r,
    computed_at: now,
    ...(computedBy ? { computed_by: computedBy } : {}),
  }))
  const { error } = await supabase
    .from('apuracao_diaria')
    .upsert(payload, { onConflict: 'rede_id,empresa_codigo,data' })
  if (error) {
    console.warn('[apuracao] upsert error:', error.message)
  }
}

export interface ApuracaoMonthMetadata {
  /** Quantidade de rows na apuracao_diaria pra esse mês. */
  count: number
  /** Timestamp ISO da última apuração que tocou esse mês. */
  lastComputedAt: string | null
  /** user_id de quem rodou a última apuração. */
  lastComputedBy: string | null
}

/**
 * Lê rows da rede pra um ano e retorna mapa `mês → metadata`. Inclui contagem
 * (pra detectar status) + última apuração (timestamp + user_id) pra exibir
 * audit info nos cards do /admin/apuracao.
 *
 * IMPORTANTE: Supabase retorna no máximo 1000 rows por SELECT. Pra redes com
 * 5+ empresas × 365 dias = 1800+ rows/ano, paginamos manualmente. Senão os
 * meses aparecem "parciais" mesmo quando 100% apurados.
 */
export const fetchApuracaoStatusByMonth = async (
  redeId: string,
  year: number,
): Promise<Map<number, ApuracaoMonthMetadata>> => {
  const result = new Map<number, ApuracaoMonthMetadata>()
  if (!supabase) return result
  type Row = { data: string; computed_at: string; computed_by: string | null }
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('apuracao_diaria')
      .select('data, computed_at, computed_by')
      .eq('rede_id', redeId)
      .gte('data', `${year}-01-01`)
      .lte('data', `${year}-12-31`)
      .range(from, from + pageSize - 1)
    if (error) {
      console.warn('[apuracao] status error:', error.message)
      return result
    }
    const rows = (data ?? []) as Row[]
    for (const row of rows) {
      const month = parseInt(row.data.slice(5, 7), 10)
      if (!month) continue
      const existing = result.get(month) ?? {
        count: 0,
        lastComputedAt: null as string | null,
        lastComputedBy: null as string | null,
      }
      existing.count += 1
      if (!existing.lastComputedAt || row.computed_at > existing.lastComputedAt) {
        existing.lastComputedAt = row.computed_at
        existing.lastComputedBy = row.computed_by
      }
      result.set(month, existing)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return result
}

/**
 * Resolve user_ids → nomes/emails via profiles. Respeita RLS — usuários que
 * o caller não pode ler simplesmente não aparecem no mapa retornado, e a UI
 * mostra '—' como fallback.
 */
export const fetchUserNamesByIds = async (
  userIds: string[],
): Promise<Map<string, { full_name: string | null; email: string }>> => {
  const result = new Map<string, { full_name: string | null; email: string }>()
  if (!supabase || userIds.length === 0) return result
  const unique = Array.from(new Set(userIds))
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', unique)
  if (error) {
    console.warn('[apuracao] fetchUserNamesByIds error:', error.message)
    return result
  }
  for (const row of (data ?? []) as Array<{ user_id: string; full_name: string | null; email: string }>) {
    result.set(row.user_id, { full_name: row.full_name, email: row.email })
  }
  return result
}

interface ComputeRowsInput {
  redeId: string
  /** Todas as empresas da rede pra essa apuração — usado pra gerar 0-rows
   *  garantindo cobertura total (empresa × dia) e detecção fácil de cache HIT. */
  empresaCodigos: number[]
  dataInicial: string
  dataFinal: string
  abastecimentos: Abastecimento[]
  lmc: LMC[]
  vendaResumo: VendaResumo[]
  /** Catálogo de produtos — usado pra casar custo do LMC por aliases de código
   *  (produtoCodigo / produtoLmcCodigo / codigo). Sem ele, combustível cujo
   *  código no abastecimento difere do LMC entra com custo 0 (margem ~100%). */
  produtos?: Produto[]
}

/**
 * Agrega dados brutos da Quality em rows diárias (1 por empresa+dia).
 * Usa LMC com a `precoCusto` mais recente por empresa+produto pra calcular custo.
 * Sempre retorna uma row pra cada combinação empresa×dia do período, mesmo que
 * sem vendas — assim o cache cobre o período inteiro e o HIT é detectado por
 * contagem (sem precisar de uma tabela paralela de "mês apurado").
 */
export const computeApuracaoRows = (input: ComputeRowsInput): ApuracaoDiariaUpsert[] => {
  // Mapa empresa+produto → preço de custo mais recente, alias-expandido pelo
  // catálogo de produtos (mesma ponte do front em useAbastecimentosAnalytics):
  // o abastecimento e o LMC às vezes referenciam o combustível por códigos
  // diferentes; sem ligar, o custo não casa e o litro entra como "sem custo".
  const costMap = buildCostMapFromLmc(input.lmc, input.produtos)

  // Agrega combustível por empresa+dia.
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

  // Agrega vendas globais por empresa+dia.
  interface VendaAgg { total: number; qtd: number }
  const vendaByKey = new Map<string, VendaAgg>()
  for (const r of input.vendaResumo) {
    const day = r.data.slice(0, 10)
    if (!day || day < input.dataInicial || day > input.dataFinal) continue
    const key = `${r.codigoEmpresa}|${day}`
    const prev = vendaByKey.get(key) ?? { total: 0, qtd: 0 }
    vendaByKey.set(key, {
      total: prev.total + r.total,
      qtd: prev.qtd + r.quantidade,
    })
  }

  // Combina todos os combos empresa×dia do período. 0-rows preenchem buracos.
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

// ═══════════════════════════════════════════════════════════════════════
// Cache RAW de abastecimentos (apuracao_abastecimentos)
// Permite que /operacao consuma dados row-level sem refetchar a Quality.
// ═══════════════════════════════════════════════════════════════════════

/** Row do cache de abastecimentos raw (snake_case do Supabase). */
export interface AbastecimentoCacheRow {
  rede_id: string
  empresa_codigo: number
  abastecimento_codigo: number
  data_fiscal: string | null  // yyyy-MM-dd
  data_hora_abastecimento: string | null  // ISO
  codigo_produto: number | null
  codigo_frentista: number | null
  codigo_bico: number | null
  quantidade: number
  valor_unitario: number
  valor_total: number
  placa: string | null
  /**
   * Preço de custo unitário no momento da apuração (do LMC mais recente).
   * Permite que /operacao calcule lucroBruto sem fetchar LMC live quando
   * cache HIT — derruba ~3-5s do load do modo Apurado.
   * Nullable porque rows antigos (antes da migration) não têm.
   */
  preco_custo: number | null
}

export type AbastecimentoCacheUpsert = Omit<AbastecimentoCacheRow, 'computed_at'>

interface FetchAbastCacheParams {
  empresaCodigos?: number[]  // omitido = todas da rede
  dataInicial: string
  dataFinal: string
}

/** Lê abastecimentos do cache pra um período (paginação cursor sequencial).
 *  Tentei paralelizar via range mas Postgres saturou — cada page virou 4s.
 *  Serial cursor com índice composto fica ~250ms por page. */
export const fetchAbastecimentosCache = async (
  params: FetchAbastCacheParams
): Promise<AbastecimentoCacheRow[]> => {
  if (!supabase) return []
  const all: AbastecimentoCacheRow[] = []
  const pageSize = 1000
  let cursor = -1
  while (true) {
    // Seleção explícita das colunas usadas no front (rede_id sai porque
    // já é filtrado por RLS, e a economia de payload acumula em 10k rows).
    let query = supabase
      .from('apuracao_abastecimentos')
      .select('empresa_codigo,abastecimento_codigo,data_fiscal,data_hora_abastecimento,codigo_produto,codigo_frentista,codigo_bico,quantidade,valor_unitario,valor_total,placa,preco_custo')
      .gte('data_fiscal', params.dataInicial)
      .lte('data_fiscal', params.dataFinal)
      .order('abastecimento_codigo', { ascending: true })
      .limit(pageSize)
    if (cursor >= 0) {
      query = query.gt('abastecimento_codigo', cursor)
    }
    if (params.empresaCodigos && params.empresaCodigos.length > 0) {
      query = query.in('empresa_codigo', params.empresaCodigos)
    }
    const { data, error } = await query
    if (error) {
      console.warn('[apuracao_abast] fetch error:', error.message)
      break
    }
    const rows = (data ?? []) as AbastecimentoCacheRow[]
    if (rows.length === 0) break
    all.push(...rows)
    if (rows.length < pageSize) break
    cursor = rows[rows.length - 1].abastecimento_codigo
  }
  return all
}

/** Upsert em lote. Idempotente via PK (rede, empresa, abastecimento_codigo). */
export const upsertAbastecimentosCache = async (
  rows: AbastecimentoCacheUpsert[]
): Promise<void> => {
  if (!supabase || rows.length === 0) return
  // Supabase aceita lotes grandes em upsert; divide em chunks de 500 pra
  // evitar payload gigante e dar feedback granular se um falhar.
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('apuracao_abastecimentos')
      .upsert(chunk, { onConflict: 'rede_id,empresa_codigo,abastecimento_codigo' })
    if (error) {
      console.warn('[apuracao_abast] upsert error:', error.message)
      return
    }
  }
}

/**
 * Ponte entre os códigos do MESMO produto (produtoCodigo / produtoLmcCodigo /
 * codigo). Espelha o `codeAliases` de useAbastecimentosAnalytics. Cada código
 * mapeia pra lista de todos os aliases do produto.
 */
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

/**
 * Constrói o mapa empresa+produto → precoCusto mais recente a partir do LMC.
 * Mesmo algoritmo usado em `computeApuracaoRows`, extraído pra reuso pela
 * apuração ao gravar o `preco_custo` em cada row do cache de abast.
 *
 * Quando `produtos` é informado, o custo é gravado sob TODOS os aliases do
 * produto — assim o lookup direto `${emp}-${codigoProduto}` casa mesmo quando o
 * abastecimento usa um código diferente do LMC (senão margem ~100% falsa).
 */
export const buildCostMapFromLmc = (
  lmc: import('@/api/types/combustivel').LMC[],
  produtos?: Produto[],
): Map<string, number> => {
  const aliasMap = produtos && produtos.length > 0 ? buildAliasMap(produtos) : null
  const costMap = new Map<string, number>()
  const sortedLmc = [...lmc].sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento))
  for (const l of sortedLmc) {
    if (l.precoCusto <= 0) continue
    for (const prodCode of l.produtoCodigo) {
      const codes = aliasMap?.get(prodCode) ?? [prodCode]
      for (const c of codes) {
        const key = `${l.empresaCodigo}-${c}`
        // LMC já vem ordenado do mais recente → primeiro a gravar a chave vence.
        if (!costMap.has(key)) costMap.set(key, l.precoCusto)
      }
    }
  }
  return costMap
}

/** Mapeia raw da Quality (Abastecimento) → row do cache. */
export const abastecimentoToCacheRow = (
  a: Abastecimento,
  redeId: string,
  costMap?: Map<string, number>,
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
})

/** Mapeia row do cache → Abastecimento (shape da API Quality) pra reuso a jusante. */
export const cacheRowToAbastecimento = (r: AbastecimentoCacheRow): Abastecimento => ({
  codigo: r.abastecimento_codigo,
  dataFiscal: r.data_fiscal ?? '',
  horaFiscal: '',
  codigoBico: r.codigo_bico ?? 0,
  codigoProduto: r.codigo_produto ?? 0,
  quantidade: r.quantidade,
  valorUnitario: r.valor_unitario,
  valorTotal: r.valor_total,
  codigoFrentista: r.codigo_frentista ?? 0,
  afericao: false,
  vendaItemCodigo: 0,
  precoCadastro: 0,
  tabelaPrecoA: 0,
  tabelaPrecoB: 0,
  tabelaPrecoC: 0,
  empresaCodigo: r.empresa_codigo,
  dataHoraAbastecimento: r.data_hora_abastecimento ?? '',
  stringAll: '',
  placa: r.placa ?? '',
  abastecimentoCodigo: r.abastecimento_codigo,
  encerrante: 0,
  // Propagar custo gravado durante a apuração — quando definido, o front
  // dispensa o LMC live pra calcular lucroBruto.
  precoCusto: r.preco_custo ?? undefined,
})

// ═══════════════════════════════════════════════════════════════════════
// Cache de CAIXAS (apuracao_caixas)
// Alimenta tab "Caixa & Turnos" em /operacao + apuradoPorDia em ResumoOperacao.
// ═══════════════════════════════════════════════════════════════════════

export interface CaixaCacheRow {
  rede_id: string
  empresa_codigo: number
  caixa_codigo: number
  turno_codigo: number
  data_movimento: string
  turno: string | null
  pdv_codigo: number | null
  funcionario_codigo: number | null
  centro_custo: number | null
  abertura: string | null
  fechamento: string | null
  fechado: boolean
  consolidado: boolean
  bloqueado: boolean
  tipo_bloqueio: string | null
  tipo_inclusao: string | null
  apurado: number
  diferenca: number
}

export type CaixaCacheUpsert = Omit<CaixaCacheRow, 'computed_at'>

interface FetchCaixasCacheParams {
  empresaCodigos?: number[]
  dataInicial: string
  dataFinal: string
}

export const fetchCaixasCache = async (params: FetchCaixasCacheParams): Promise<CaixaCacheRow[]> => {
  if (!supabase) return []
  const all: CaixaCacheRow[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    let query = supabase
      .from('apuracao_caixas')
      .select('*')
      .gte('data_movimento', params.dataInicial)
      .lte('data_movimento', params.dataFinal)
      .order('data_movimento', { ascending: true })
      .range(from, from + pageSize - 1)
    if (params.empresaCodigos && params.empresaCodigos.length > 0) {
      query = query.in('empresa_codigo', params.empresaCodigos)
    }
    const { data, error } = await query
    if (error) {
      console.warn('[apuracao_caixas] fetch error:', error.message)
      break
    }
    const rows = (data ?? []) as CaixaCacheRow[]
    all.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return all
}

export const upsertCaixasCache = async (rows: CaixaCacheUpsert[]): Promise<void> => {
  if (!supabase || rows.length === 0) return
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('apuracao_caixas')
      .upsert(chunk, { onConflict: 'rede_id,empresa_codigo,caixa_codigo,turno_codigo,data_movimento' })
    if (error) {
      console.warn('[apuracao_caixas] upsert error:', error.message)
      return
    }
  }
}

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

export const cacheRowToCaixa = (r: CaixaCacheRow): Caixa => ({
  codigo: r.caixa_codigo,
  empresaCodigo: r.empresa_codigo,
  caixaCodigo: r.caixa_codigo,
  dataMovimento: r.data_movimento,
  turnoCodigo: r.turno_codigo,
  turno: r.turno ?? '',
  pdvCodigo: r.pdv_codigo ?? 0,
  funcionarioCodigo: r.funcionario_codigo ?? 0,
  centroCusto: r.centro_custo ?? 0,
  abertura: r.abertura ?? '',
  fechamento: r.fechamento ?? '',
  fechado: r.fechado,
  consolidado: r.consolidado,
  tipoInclusao: r.tipo_inclusao ?? '',
  bloqueado: r.bloqueado,
  tipoBloqueio: r.tipo_bloqueio ?? '',
  apurado: r.apurado,
  diferenca: r.diferenca,
})

// ═══════════════════════════════════════════════════════════════════════
// Cache de FORMAS DE PAGAMENTO (apuracao_formas_pagamento)
// ═══════════════════════════════════════════════════════════════════════

export interface FormaPagamentoCacheRow {
  rede_id: string
  empresa_codigo: number
  venda_codigo: number
  venda_prazo_codigo: number
  data_movimento: string | null
  vencimento: string | null
  forma_pagamento_codigo: number | null
  tipo_forma_pagamento: string | null
  nome_forma_pagamento: string | null
  administradora_codigo: number | null
  turno_codigo: number | null
  valor_pagamento: number
  taxa_percentual: number
}

export type FormaPagamentoCacheUpsert = Omit<FormaPagamentoCacheRow, 'computed_at'>

export const fetchFormasPagamentoCache = async (
  params: FetchCaixasCacheParams,
): Promise<FormaPagamentoCacheRow[]> => {
  if (!supabase) return []
  const all: FormaPagamentoCacheRow[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    let query = supabase
      .from('apuracao_formas_pagamento')
      .select('*')
      .gte('data_movimento', params.dataInicial)
      .lte('data_movimento', params.dataFinal)
      .order('data_movimento', { ascending: true })
      .range(from, from + pageSize - 1)
    if (params.empresaCodigos && params.empresaCodigos.length > 0) {
      query = query.in('empresa_codigo', params.empresaCodigos)
    }
    const { data, error } = await query
    if (error) {
      console.warn('[apuracao_formas] fetch error:', error.message)
      break
    }
    const rows = (data ?? []) as FormaPagamentoCacheRow[]
    all.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return all
}

export const upsertFormasPagamentoCache = async (rows: FormaPagamentoCacheUpsert[]): Promise<void> => {
  if (!supabase || rows.length === 0) return
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('apuracao_formas_pagamento')
      .upsert(chunk, {
        onConflict: 'rede_id,empresa_codigo,venda_codigo,venda_prazo_codigo',
      })
    if (error) {
      console.warn('[apuracao_formas] upsert error:', error.message)
      return
    }
  }
}

export const formaPagamentoToCacheRow = (
  f: VendaFormaPagamento,
  redeId: string,
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

export const cacheRowToFormaPagamento = (r: FormaPagamentoCacheRow): VendaFormaPagamento => ({
  codigo: r.venda_codigo,
  empresaCodigo: r.empresa_codigo,
  vendaCodigo: r.venda_codigo,
  vendaPrazoCodigo: r.venda_prazo_codigo,
  dataMovimento: r.data_movimento ?? '',
  vencimento: r.vencimento ?? '',
  valorPagamento: r.valor_pagamento,
  taxaPercentual: r.taxa_percentual,
  formaPagamentoCodigo: r.forma_pagamento_codigo ?? 0,
  administradoraCodigo: r.administradora_codigo ?? 0,
  turnoCodigo: r.turno_codigo ?? 0,
  tipoFormaPagamento: r.tipo_forma_pagamento ?? '',
  nomeFormaPagamento: r.nome_forma_pagamento ?? '',
})

// ═══════════════════════════════════════════════════════════════════════
// Cache de VENDAS DA LOJA / Conveniência (apuracao_vendas)
// ═══════════════════════════════════════════════════════════════════════
// Agregado por (rede, empresa, dia, produto). Guarda quantidade, total de
// venda, total de custo e o nº de LINHAS de item — a tela de Conveniência
// calcula o ticket médio como faturamento ÷ nº de itens, então precisamos
// preservar a contagem de linhas, não só os somatórios.
// Veja docs/supabase-apuracao-vendas.sql para o schema completo.

export interface ApuracaoVendaRow {
  rede_id: string
  empresa_codigo: number
  data: string // yyyy-MM-dd
  produto_codigo: number
  quantidade: number
  total_venda: number
  total_custo: number
  linhas: number
  computed_at: string
  computed_by: string | null
}

/** Linha pronta pra UPSERT (sem campos de auditoria que o banco preenche). */
export type ApuracaoVendaUpsert = Omit<ApuracaoVendaRow, 'computed_at' | 'computed_by'>

export const fetchVendasCache = async (
  params: FetchCaixasCacheParams,
): Promise<ApuracaoVendaRow[]> => {
  if (!supabase) return []
  const all: ApuracaoVendaRow[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    let query = supabase
      .from('apuracao_vendas')
      .select('*')
      .gte('data', params.dataInicial)
      .lte('data', params.dataFinal)
      .order('data', { ascending: true })
      .range(from, from + pageSize - 1)
    if (params.empresaCodigos && params.empresaCodigos.length > 0) {
      query = query.in('empresa_codigo', params.empresaCodigos)
    }
    const { data, error } = await query
    if (error) {
      console.warn('[apuracao_vendas] fetch error:', error.message)
      break
    }
    const rows = (data ?? []) as ApuracaoVendaRow[]
    all.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return all
}

export const upsertVendasCache = async (
  rows: ApuracaoVendaUpsert[],
  computedBy?: string | null,
): Promise<void> => {
  if (!supabase || rows.length === 0) return
  const stamped = rows.map((r) => ({ ...r, computed_by: computedBy ?? null }))
  const chunkSize = 500
  for (let i = 0; i < stamped.length; i += chunkSize) {
    const chunk = stamped.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('apuracao_vendas')
      .upsert(chunk, { onConflict: 'rede_id,empresa_codigo,data,produto_codigo' })
    if (error) {
      console.warn('[apuracao_vendas] upsert error:', error.message)
      return
    }
  }
}

/**
 * Agrega itens de venda crus (VendaItem) em linhas do cache, somando por
 * (empresa, dia, produto). `linhas` conta o nº de itens de venda, pra
 * preservar o ticket médio (faturamento ÷ nº de itens) da Conveniência.
 */
export const aggregateVendaItensToCache = (
  itens: VendaItem[],
  redeId: string,
): ApuracaoVendaUpsert[] => {
  const map = new Map<string, ApuracaoVendaUpsert>()
  for (const it of itens) {
    const data = it.dataMovimento ? it.dataMovimento.slice(0, 10) : ''
    if (!data) continue
    const key = `${it.empresaCodigo}|${data}|${it.produtoCodigo}`
    const existing = map.get(key)
    if (existing) {
      existing.quantidade += it.quantidade ?? 0
      existing.total_venda += it.totalVenda ?? 0
      existing.total_custo += it.totalCusto ?? 0
      existing.linhas += 1
    } else {
      map.set(key, {
        rede_id: redeId,
        empresa_codigo: it.empresaCodigo,
        data,
        produto_codigo: it.produtoCodigo,
        quantidade: it.quantidade ?? 0,
        total_venda: it.totalVenda ?? 0,
        total_custo: it.totalCusto ?? 0,
        linhas: 1,
      })
    }
  }
  return Array.from(map.values())
}

/**
 * Lista os dias do período (yyyy-MM-dd). Útil pra detectar "buracos" entre o
 * que foi requisitado e o que voltou do cache.
 */
export const enumerateDays = (dataInicial: string, dataFinal: string): string[] => {
  const days: string[] = []
  const [yi, mi, di] = dataInicial.split('-').map(Number)
  const [yf, mf, df] = dataFinal.split('-').map(Number)
  if (!yi || !mi || !di || !yf || !mf || !df) return days
  const start = new Date(yi, mi - 1, di)
  const end = new Date(yf, mf - 1, df)
  const cur = new Date(start)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

/**
 * Retorna a data de ontem (yyyy-MM-dd) — usada como fronteira entre cacheável
 * e volátil. Hoje nunca entra no cache (dados ainda estão sendo gerados).
 */
const yesterdayStr = (): string => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const todayStr = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface PeriodSplit {
  /** Subrange cacheável (dias < hoje). null se não há dias fechados no período. */
  closedDays: { dataInicial: string; dataFinal: string } | null
  /** Sub-range volátil (hoje, se está dentro do período). null se hoje não está no período. */
  todayPart: { dataInicial: string; dataFinal: string } | null
  /** Período tem dias futuros (sem dados) — sinaliza pra UI eventualmente. */
  hasFutureDays: boolean
}

/**
 * Divide o período de filtro em duas faixas:
 *  - closedDays: [dataInicial..min(dataFinal, ontem)] — vai pro cache
 *  - todayPart:  [hoje..hoje] se hoje estiver no período — sempre live
 *
 * Cenários:
 *  - Mês passado completo → closedDays = [01..30], todayPart = null
 *  - Mês corrente (hoje=17) → closedDays = [01..16], todayPart = [17..17]
 *  - Só hoje              → closedDays = null,    todayPart = [hoje..hoje]
 *  - Só futuro            → ambos null, hasFutureDays = true
 */
export const splitPeriodAtToday = (dataInicial: string, dataFinal: string): PeriodSplit => {
  const today = todayStr()
  const yest = yesterdayStr()

  // Período inteiro futuro → nada a fazer
  if (dataInicial > today) {
    return { closedDays: null, todayPart: null, hasFutureDays: true }
  }

  const closedEnd = dataFinal < yest ? dataFinal : yest
  const closedDays = dataInicial <= closedEnd
    ? { dataInicial, dataFinal: closedEnd }
    : null

  const includesToday = dataInicial <= today && today <= dataFinal
  const todayPart = includesToday ? { dataInicial: today, dataFinal: today } : null

  const hasFutureDays = dataFinal > today
  return { closedDays, todayPart, hasFutureDays }
}
