import { formatCurrency, formatNumber } from '@/lib/formatters'

/** Percentual com vírgula (1 casa por padrão). */
export const pct = (n: number, dec = 1): string => `${n.toFixed(dec).replace('.', ',')}%`

/** BRL completo (R$ 1.234.567,00). */
export const brl = (n: number): string => formatCurrency(n)

/** BRL curto pra KPIs grandes: R$ 4,2M · R$ 499K · R$ 312. */
export const brlShort = (n: number): string => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `${sign}R$ ${Math.round(abs / 1_000)}K`
  return `${sign}R$ ${Math.round(abs)}`
}

/** Litros completo: 136.999 L. */
export const liters = (n: number): string => `${formatNumber(Math.round(n))} L`

/** Litros curto: 1,8M L · 612K L. */
export const litersShort = (n: number): string => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M L`
  if (abs >= 10_000) return `${Math.round(n / 1_000)}K L`
  return `${formatNumber(Math.round(n))} L`
}

/** Variação % entre atual e base (null quando base <= 0). */
export const variacaoPct = (atual: number, base: number): number | null =>
  base > 0 ? ((atual - base) / base) * 100 : null
