import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Retorna a data de hoje como yyyy-MM-dd (timezone local).
 * Útil pra comparar com strings de data vindas de filtros.
 */
export const todayStr = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * O período inteiro já passou? (dataFinal anterior a hoje.)
 * Usado pra esconder elementos "ao vivo" — turnos abertos, caixas ao vivo etc.
 * que só fazem sentido pro período corrente.
 */
export const isPastPeriod = (dataFinal: string): boolean => {
  if (!dataFinal) return false
  return dataFinal < todayStr()
}
