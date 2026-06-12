/**
 * Conversão de timestamps da API Quality (entregues em UTC) para o horário de
 * Brasília (America/Sao_Paulo, UTC−3) na exibição.
 *
 * A API/cache guarda abertura/fechamento de caixa em UTC. Ex.: um turno aberto
 * 00:35 (local) chega como "...T03:35..." — sem converter, a tela mostrava 3h a
 * mais e fechamentos pareciam acontecer antes da abertura.
 */

const SP_PARTS = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Parseia o ISO da API como UTC (força 'Z' quando não há fuso explícito). */
const parseApiDate = (iso: string): Date | null => {
  let s = iso.trim().replace(' ', 'T')
  if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z'
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const partsOf = (d: Date): Record<string, string> =>
  Object.fromEntries(SP_PARTS.formatToParts(d).map((p) => [p.type, p.value]))

/** "DD/MM/AAAA HH:MM" no horário de Brasília. */
export const formatDateTimeBR = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  const d = parseApiDate(iso)
  if (!d) return '-'
  const p = partsOf(d)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** "HH:MM" no horário de Brasília. */
export const formatTimeBR = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  const d = parseApiDate(iso)
  if (!d) return '-'
  const p = partsOf(d)
  return `${p.hour}:${p.minute}`
}
