import type { ReabastNivel } from '@/pages/Dashboard/hooks/useReabastecimento'

/** Cores por faixa de nível — iguais em todo o sistema (crítico < 20%, baixo 20–30%). */
export const COR_NIVEL: Record<ReabastNivel, { fill: string; text: string; bar: string; dot: string; badge: string }> = {
  critico: { fill: '#ef4444', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  alerta: { fill: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  ok: { fill: '#22c55e', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
}

export const nivelDe = (pct: number): ReabastNivel => (pct < 20 ? 'critico' : pct < 30 ? 'alerta' : 'ok')

/** Nome curto do produto pra caber embaixo do ícone (ex.: "Gasolina a…"). */
export const produtoCurto = (nome: string, max = 10) => {
  const n = nome.replace(/^OLEO\s+/i, '').replace(/\bCOMUM\b/i, '').trim()
  const bonito = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
  return bonito.length > max ? `${bonito.slice(0, max - 1)}…` : bonito
}

/** Nome do produto em caixa normal, inteiro. */
export const produtoBonito = (nome: string) => {
  const n = nome.trim().toLowerCase()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** Medição física do LMC com mais dias que isso: a estimativa de litros é
 *  avisada como pouco confiável ("confira a régua"). */
export const MEDICAO_VELHA_DIAS = 3
