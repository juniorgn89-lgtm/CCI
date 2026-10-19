/** Helpers de data compartilhados pelos modais da Central (Visão Geral). */

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** yyyy-MM-dd → dd/mm/aaaa. */
export const brDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

/** yyyy-MM-dd → dd/mm/aa. */
export const brDateShort = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** Dias de `iso` em relação a hoje (negativo = passado). */
export const diffDias = (iso: string, hoje = todayISO()) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const [hy, hm, hd] = hoje.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86_400_000)
}

/** "hoje" · "há 3 dias" · "em 12 dias". */
export const relDias = (iso: string, hoje = todayISO()) => {
  if (!iso) return ''
  const n = diffDias(iso, hoje)
  if (n === 0) return 'hoje'
  if (n < 0) return `há ${-n} dia${-n === 1 ? '' : 's'}`
  return `em ${n} dia${n === 1 ? '' : 's'}`
}

export const pctFmt = (v: number, casas = 1) => `${v.toFixed(casas).replace('.', ',')}%`

/** Variação percentual; null sem base. */
export const varPct = (atual: number, anterior: number): number | null => (anterior > 0 ? ((atual - anterior) / anterior) * 100 : null)

/** Classe padrão do DialogContent dos modais da Central (largo, rolagem interna). */
export const MODAL_CLS = 'flex max-h-[88vh] w-[95vw] max-w-5xl flex-col gap-3 overflow-hidden p-0'
