import { supabase } from '@/lib/supabase'
import type { Abastecimento, LMC } from '@/api/types/combustivel'
import type { VendaResumo } from '@/api/types/venda'

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
 */
export const upsertApuracaoDiaria = async (rows: ApuracaoDiariaUpsert[]): Promise<void> => {
  if (!supabase || rows.length === 0) return
  const { error } = await supabase
    .from('apuracao_diaria')
    .upsert(rows, { onConflict: 'rede_id,empresa_codigo,data' })
  if (error) {
    console.warn('[apuracao] upsert error:', error.message)
  }
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
}

/**
 * Agrega dados brutos da Quality em rows diárias (1 por empresa+dia).
 * Usa LMC com a `precoCusto` mais recente por empresa+produto pra calcular custo.
 * Sempre retorna uma row pra cada combinação empresa×dia do período, mesmo que
 * sem vendas — assim o cache cobre o período inteiro e o HIT é detectado por
 * contagem (sem precisar de uma tabela paralela de "mês apurado").
 */
export const computeApuracaoRows = (input: ComputeRowsInput): ApuracaoDiariaUpsert[] => {
  // Mapa empresa+produto → preço de custo mais recente.
  const costMap = new Map<string, number>()
  const sortedLmc = [...input.lmc].sort(
    (a, b) => b.dataMovimento.localeCompare(a.dataMovimento)
  )
  for (const lmc of sortedLmc) {
    for (const prodCode of lmc.produtoCodigo) {
      const key = `${lmc.empresaCodigo}-${prodCode}`
      if (!costMap.has(key) && lmc.precoCusto > 0) {
        costMap.set(key, lmc.precoCusto)
      }
    }
  }

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

/**
 * Detecta se o período corresponde a um mês inteiro fechado (anterior ao
 * mês corrente). Cache só popula/lê nessa condição na v1.
 */
export const isFechadoMonth = (dataInicial: string, dataFinal: string): boolean => {
  const [yi, mi, di] = dataInicial.split('-').map(Number)
  const [yf, mf, df] = dataFinal.split('-').map(Number)
  if (!yi || !mi || !di || !yf || !mf || !df) return false
  if (yi !== yf || mi !== mf) return false
  if (di !== 1) return false
  const lastDay = new Date(yi, mi, 0).getDate()
  if (df !== lastDay) return false

  const today = new Date()
  const currentY = today.getFullYear()
  const currentM = today.getMonth() + 1
  if (yi > currentY) return false
  if (yi === currentY && mi >= currentM) return false
  return true
}

/**
 * Lista os dias do período (yyyy-MM-dd). Útil pra detectar "buracos" entre o
 * que foi requisitado e o que voltou do cache.
 */
export const enumerateDays = (dataInicial: string, dataFinal: string): string[] => {
  const days: string[] = []
  const [yi, mi, di] = dataInicial.split('-').map(Number)
  const [yf, mf, df] = dataFinal.split('-').map(Number)
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
