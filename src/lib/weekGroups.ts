/** Utilitários de semana de calendário (2ª→dom) — usados pelos calendários de
 *  recebimento/pagamento (Financeiro). */

/** ISO da 2ª-feira da semana de `dateStr` (local). */
export const mondayOf = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const off = (dt.getDay() + 6) % 7 // 0=2ª … 6=dom
  dt.setDate(dt.getDate() - off)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

/** Rótulo curto do chip de semana: "01–07" ou "29/06–05/07" se cruzar mês. */
export const weekChipLabel = (min: string, max: string): string => {
  const [, mm1, dd1] = min.split('-')
  const [, mm2, dd2] = max.split('-')
  return mm1 === mm2 ? `${dd1}–${dd2}` : `${dd1}/${mm1}–${dd2}/${mm2}`
}
