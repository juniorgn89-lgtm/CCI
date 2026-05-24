/**
 * Buckets de aging contextuais para títulos a receber e a pagar.
 *
 * O bucket é **mutuamente exclusivo** (não cumulativo) e a semântica muda
 * conforme a situação selecionada:
 *  - situação='vencido' → bucket mede dias de atraso
 *  - situação='aberto'  → bucket mede dias até vencer
 *  - situação='todos'   → bucket mede distância absoluta (vence/venceu em até X dias)
 *  - situação='pago'    → aging desabilitado (não tem semântica útil)
 */

export type AgingBucket = 'todos' | 'ate7' | 'de8a15' | 'de16a30' | 'mais30'

export type Situacao = 'todos' | 'aberto' | 'vencido' | 'pago'

export interface AgingRow {
  /** Data de vencimento em formato yyyy-MM-dd (ou ISO). */
  dataVencimento: string
  /** Tag de situação calculada no hook. */
  statusTag: 'vencido' | 'a-vencer' | 'pago' | 'cancelado'
}

interface BucketDef {
  value: AgingBucket
  label: string
  /** Predicado em cima do número de dias absoluto. */
  test: (absDias: number) => boolean
}

const BUCKETS: BucketDef[] = [
  { value: 'todos', label: 'Todos', test: () => true },
  { value: 'ate7', label: '≤7d', test: (d) => d <= 7 },
  { value: 'de8a15', label: '8-15d', test: (d) => d > 7 && d <= 15 },
  { value: 'de16a30', label: '16-30d', test: (d) => d > 15 && d <= 30 },
  { value: 'mais30', label: '>30d', test: (d) => d > 30 },
]

export const AGING_BUCKETS: { value: AgingBucket; label: string }[] = BUCKETS.map(
  ({ value, label }) => ({ value, label }),
)

/** Calcula dias absolutos entre a data de vencimento e hoje. */
const diasAbsAteVencimento = (dataVencimento: string): number => {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(`${dataVencimento}T00:00:00`)
  if (Number.isNaN(venc.getTime())) return Number.POSITIVE_INFINITY
  const ms = venc.getTime() - hoje.getTime()
  return Math.abs(Math.floor(ms / 86_400_000))
}

/**
 * Retorna true se a row passa pelo filtro de aging considerando a situação.
 *  - bucket='todos' sempre passa.
 *  - situação='pago' faz o aging ser ignorado (sempre passa).
 *  - Para 'aberto'/'vencido', filtra apenas rows com a tag correspondente.
 *  - Para 'todos' como situação, considera vencidos + a vencer (ignora pagos/cancelados).
 */
export const matchesAgingBucket = (
  row: AgingRow,
  bucket: AgingBucket,
  situacao: Situacao,
): boolean => {
  if (bucket === 'todos') return true
  if (situacao === 'pago') return true // aging não faz sentido pra pagos

  // Pagos/cancelados nunca entram no aging (sem semântica de "quantos dias")
  if (row.statusTag === 'pago' || row.statusTag === 'cancelado') return false

  // Quando situação é 'aberto' ou 'vencido', a tag já foi filtrada antes
  // por isso aqui só importa medir os dias.
  const def = BUCKETS.find((b) => b.value === bucket)
  if (!def) return true
  return def.test(diasAbsAteVencimento(row.dataVencimento))
}
