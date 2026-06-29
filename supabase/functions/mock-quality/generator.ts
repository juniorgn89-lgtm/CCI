// @ts-nocheck — Deno. Fundação do gerador DETERMINÍSTICO.
//
// Mesma (posto, data) → mesma sequência → mesmos dados, sempre. É isso que
// garante que tudo reconcilie entre telas e seja estável a refetch/cache.
// As Fases 1+ usam `rngFor(empresaCodigo, dia, escopo)` pra gerar os
// abastecimentos/vendas/pagamentos de cada dia a partir desta base.

/** Hash FNV-1a (32-bit) de partes string/number → semente estável. */
export const hashSeed = (...parts: Array<string | number>): number => {
  const s = parts.join('|')
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** PRNG mulberry32 — rápido, determinístico, bom o suficiente pra dados fictícios. */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Conveniência: gerador semeado por um conjunto de chaves. */
export const rngFor = (...parts: Array<string | number>) => mulberry32(hashSeed(...parts))

/* ─── Helpers de amostragem (usados nas próximas fases) ─── */

/** Float em [min, max). */
export const between = (rng: () => number, min: number, max: number): number => min + rng() * (max - min)

/** Inteiro em [min, max]. */
export const intBetween = (rng: () => number, min: number, max: number): number => Math.floor(between(rng, min, max + 1))

/** Escolhe um item de um array. */
export const pick = <T>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]

/** Escolhe um índice por pesos relativos (ex.: mix de formas de pagamento). */
export const weightedIndex = (rng: () => number, weights: number[]): number => {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.length - 1
}
