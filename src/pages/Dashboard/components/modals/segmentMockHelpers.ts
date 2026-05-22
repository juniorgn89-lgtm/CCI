import type { DrilldownDailyRow } from './ProdutoDrilldownModal'

/**
 * Pseudo-random deterministic from string seed — keeps mock numbers stable
 * across re-renders so the UI doesn't flicker when reopening modals.
 */
const seededRandom = (seed: string): (() => number) => {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/**
 * Builds a list of yyyy-MM-dd dates between two ISO dates, inclusive.
 * Falls back to 21 sample days starting from dataInicial if range parses oddly.
 */
export const buildDateRange = (dataInicial: string, dataFinal: string): string[] => {
  const start = new Date(`${dataInicial}T00:00:00`)
  const end = new Date(`${dataFinal}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return Array.from({ length: 21 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }
  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/**
 * Generates daily faturamento points that sum approximately to a target.
 * Variation is organic-looking (peaks on weekends, dips midweek).
 */
export const generateDailyEvolution = (
  seed: string,
  dates: string[],
  totalFaturamento: number,
): Array<{ data: string; label: string; faturamento: number }> => {
  if (dates.length === 0) return []
  const rand = seededRandom(seed)
  const baseDaily = totalFaturamento / dates.length
  const raw = dates.map((d) => {
    const date = new Date(`${d}T00:00:00`)
    const weekday = date.getDay()
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.15 : weekday === 3 ? 0.92 : 1
    const noise = 0.7 + rand() * 0.6
    return baseDaily * weekendBoost * noise
  })
  const sum = raw.reduce((s, v) => s + v, 0)
  const scale = sum > 0 ? totalFaturamento / sum : 1
  return dates.map((d, i) => ({
    data: d,
    label: d.split('-').reverse().slice(0, 2).join('/'),
    faturamento: raw[i] * scale,
  }))
}

/**
 * Distributes a total value across N rows with organic variation, sorted desc.
 * Used to break a segment total into produtos/grupos.
 */
export const distributeAcrossRows = (
  seed: string,
  count: number,
  total: number,
): number[] => {
  const rand = seededRandom(seed)
  const weights = Array.from({ length: count }, () => 0.4 + rand() * 1.6)
  const weightSum = weights.reduce((s, w) => s + w, 0)
  return weights
    .map((w) => (w / weightSum) * total)
    .sort((a, b) => b - a)
}

/**
 * Builds daily rows for the drill-down modal of a single produto/grupo.
 */
export const buildDrilldownRows = (
  seed: string,
  dates: string[],
  totalQtd: number,
  totalFaturamento: number,
  totalMargem: number,
): DrilldownDailyRow[] => {
  if (dates.length === 0) return []
  const sample = dates.length > 10 ? dates.slice(-10) : dates
  const rand = seededRandom(seed)
  const qtdWeights = sample.map(() => 0.6 + rand() * 0.8)
  const qtdSum = qtdWeights.reduce((s, w) => s + w, 0)
  const fatWeights = sample.map(() => 0.6 + rand() * 0.8)
  const fatSum = fatWeights.reduce((s, w) => s + w, 0)
  const marWeights = sample.map(() => 0.6 + rand() * 0.8)
  const marSum = marWeights.reduce((s, w) => s + w, 0)

  return sample.map((d, i) => ({
    data: d,
    quantidade: Math.round((qtdWeights[i] / qtdSum) * totalQtd),
    faturamento: (fatWeights[i] / fatSum) * totalFaturamento,
    margem: (marWeights[i] / marSum) * totalMargem,
  }))
}
