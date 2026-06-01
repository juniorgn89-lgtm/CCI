/**
 * Desloca uma data ISO (`yyyy-MM-dd`) N meses pra trás, preservando o dia.
 *
 * Usado pra montar o período comparativo dos KPIs (mês anterior = 1, ano
 * anterior = 12). Sempre deslocar o MESMO span do período atual (início e fim)
 * — comparar um período parcial contra o mês-calendário cheio infla/desinfla o
 * comparativo.
 *
 * Dois cuidados que o `new Date('yyyy-MM-dd')` ingênuo erra:
 * 1. **Fuso** — `new Date('2026-05-01')` é interpretado como UTC; em fusos atrás
 *    de Greenwich (ex.: America/Sao_Paulo, −03) vira 30/04 local, e o offset sai
 *    1 dia (às vezes 1 mês) errado. Aqui montamos a data em horário LOCAL.
 * 2. **Overflow de mês** — 31/05 − 1 mês não existe em abril; clampa pro último
 *    dia do mês alvo (30/04) em vez de transbordar pra 01/05.
 */
/** Hoje em horário LOCAL como `yyyy-MM-dd` (evita o off-by-one de fuso do `toISOString`). */
export const todayLocal = (): string => {
  const d = new Date()
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export const offsetPeriod = (dateStr: string, monthsBack: number): string => {
  if (!dateStr) return ''
  const [y, m, day] = dateStr.split('-').map(Number)
  const targetMonth = m - 1 - monthsBack // índice 0-based, pode ser negativo (JS normaliza o ano)
  const lastDayOfTarget = new Date(y, targetMonth + 1, 0).getDate()
  const d = new Date(y, targetMonth, Math.min(day, lastDayOfTarget))
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
