/**
 * Projeção de fechamento suavizada por média móvel.
 *
 * A extrapolação linear ingênua (`realizado × diasTotais / diasDecorridos`)
 * usa a média de TODOS os dias decorridos como ritmo — então um único dia
 * atípico (feriado, pico, queda) distorce a projeção do mês inteiro.
 *
 * Aqui o ritmo diário vem da média dos últimos `window` dias FECHADOS (hoje
 * é excluído porque é parcial) e só os dias que ainda faltam são projetados:
 *
 *   projetado = realizado + médiaMóvel(últimos N dias fechados) × diasRestantes
 *
 * A janela default de 7 dias cobre o ciclo semanal completo (dias úteis vs
 * fim de semana), suavizando a sazonalidade da semana.
 */

export interface ProjectionDailyPoint {
  /** Data do dia em yyyy-MM-dd. */
  data: string
  /** Valor realizado nesse dia (faturamento, litros, apurado, etc.). */
  value: number
}

/**
 * Ritmo diário = média dos últimos `window` dias fechados. Dias `>= today`
 * são ignorados (hoje é parcial; futuro não existe). A série é ordenada
 * internamente, então o caller não precisa se preocupar com a ordem.
 */
export const movingAverageDailyRate = (
  dailySeries: ProjectionDailyPoint[],
  today: string,
  window = 7,
): number => {
  const closed = dailySeries
    .filter((d) => d.data < today)
    .sort((a, b) => a.data.localeCompare(b.data))
  if (closed.length === 0) return 0
  const recent = window > 0 ? closed.slice(-window) : closed
  return recent.reduce((s, d) => s + d.value, 0) / recent.length
}

export interface SmoothedProjectionInput {
  /** Total já realizado (autoritativo — pode incluir o parcial de hoje). */
  realizado: number
  /** Série diária dos dias com dados (hoje é excluído do cálculo do ritmo). */
  dailySeries: ProjectionDailyPoint[]
  /** Dias que ainda faltam até o fim do período (estritamente após hoje). */
  diasRestantes: number
  /** Data de hoje em yyyy-MM-dd. */
  today: string
  /** Janela da média móvel. Default 7 (ciclo semanal). */
  window?: number
}

export interface SmoothedProjectionResult {
  /** Ritmo diário suavizado usado na projeção. */
  dailyRate: number
  /** Valor projetado para o fim do período. */
  projetado: number
}

export const smoothedProjection = ({
  realizado,
  dailySeries,
  diasRestantes,
  today,
  window = 7,
}: SmoothedProjectionInput): SmoothedProjectionResult => {
  const dailyRate = movingAverageDailyRate(dailySeries, today, window)
  const projetado = realizado + dailyRate * Math.max(0, diasRestantes)
  return { dailyRate, projetado }
}

/**
 * Texto padrão de tooltip pra qualquer label/coluna "Projeção" no app. Usar
 * sempre essa string pra manter a explicação consistente (em vez de variantes
 * diferentes em cada tela). Quando em períodos fechados (sem dias futuros),
 * a projeção fica igual ao realizado.
 */
export const PROJECAO_TOOLTIP =
  'Projeção pro fim do período: realizado até agora + (média diária dos últimos 7 dias fechados × dias restantes). Em períodos fechados, é igual ao Faturamento.'

/**
 * Variante do tooltip pra Projeção POR PRODUTO individual (Top 20 / Catálogo) —
 * alerta sobre o ruído típico de SKUs com vendas esporádicas.
 */
export const PROJECAO_TOOLTIP_PRODUTO =
  'Projeção pro fim do período: realizado + (média diária dos últimos 7 dias × dias restantes). Pode ser ruidoso pra SKUs com vendas esporádicas (poucos dias de movimento) — use como referência, não como número exato.'
