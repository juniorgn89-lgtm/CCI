/** Agrupamento de dias em semanas de calendário (2ª→dom) pra navegação semanal
 *  das tabelas "Realizado dia a dia" (Combustível, Automotivo, Conveniência). */

export interface WeekGroup<T> {
  /** ISO (yyyy-MM-dd) da 2ª-feira da semana — chave estável. */
  monday: string
  /** Dias da semana presentes no período, do mais NOVO pro mais antigo. */
  days: T[]
  /** Data mais antiga presente (yyyy-MM-dd). */
  min: string
  /** Data mais recente presente (yyyy-MM-dd). */
  max: string
}

/** ISO da 2ª-feira da semana de `dateStr` (local). */
export const mondayOf = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const off = (dt.getDay() + 6) % 7 // 0=2ª … 6=dom
  dt.setDate(dt.getDate() - off)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

/**
 * Agrupa uma lista de "dias" por semana de calendário (2ª→dom). Retorna as
 * semanas da mais ANTIGA (esquerda) pra mais RECENTE (direita), e os dias de
 * cada semana do mais NOVO pro mais antigo (igual às tabelas). Semanas das
 * bordas do período podem ter < 7 dias.
 */
export const groupDaysByWeek = <T>(days: T[], getDate: (d: T) => string): WeekGroup<T>[] => {
  const byWeek = new Map<string, T[]>()
  for (const d of days) {
    const k = mondayOf(getDate(d))
    const arr = byWeek.get(k)
    if (arr) arr.push(d)
    else byWeek.set(k, [d])
  }
  return Array.from(byWeek.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((monday) => {
      const ds = [...byWeek.get(monday)!].sort((a, b) => getDate(b).localeCompare(getDate(a)))
      return { monday, days: ds, min: getDate(ds[ds.length - 1]), max: getDate(ds[0]) }
    })
}

/** Rótulo curto do chip de semana: "01–07" ou "29/06–05/07" se cruzar mês. */
export const weekChipLabel = (min: string, max: string): string => {
  const [, mm1, dd1] = min.split('-')
  const [, mm2, dd2] = max.split('-')
  return mm1 === mm2 ? `${dd1}–${dd2}` : `${dd1}/${mm1}–${dd2}/${mm2}`
}
