import { formatCurrency, formatNumber } from '@/lib/formatters'
import { todayLocal } from '@/lib/period'

/** Período do mês pra projeção: dia decorrido / dias do mês / fração (0–1). */
export const periodoMes = (dataInicial: string, dataFinal: string): { dia: number; dias: number; frac: number } => {
  const today = todayLocal()
  const fim = dataFinal > today ? today : dataFinal
  const [y, m, d1] = dataInicial.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  const f = fim.split('-').map(Number)
  const sameMonth = f[0] === y && f[1] === m
  const dia = Math.min(sameMonth ? Math.max(1, f[2] - (d1 - 1)) : dias, dias)
  return { dia, dias, frac: dias > 0 ? dia / dias : 1 }
}

/** Percentual sem casa decimal por padrão (arredondado). */
export const pct = (n: number, dec = 0): string => `${n.toFixed(dec).replace('.', ',')}%`

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
