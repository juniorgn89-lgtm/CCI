import { create } from 'zustand'

/**
 * Rastreio local de consumo de tokens/custo do Assistente IA.
 *
 * IMPORTANTE: o rastreio é por NAVEGADOR (localStorage), escopado por
 * (redeId, mês corrente). Se múltiplos usuários da mesma rede usarem o
 * Assistente em browsers diferentes, cada um vê só o seu próprio consumo.
 *
 * A fonte de verdade do gasto REAL fica no console.anthropic.com → Workspace
 * → Analytics. Este tracker é só pra aviso preventivo ao usuário ("você
 * consumiu X deste limite").
 *
 * O bloqueio quando estoura o limite é feito pela Anthropic (Spending limit
 * da workspace), não aqui.
 */

const STORAGE_PREFIX = 'visor360-assistente-usage'

// Preços do claude-sonnet-4-5 (maio/2026). Atualizar se a Anthropic mexer.
export const INPUT_PRICE_USD_PER_MTOK = 3
export const OUTPUT_PRICE_USD_PER_MTOK = 15

const INPUT_COST_PER_TOKEN = INPUT_PRICE_USD_PER_MTOK / 1_000_000
const OUTPUT_COST_PER_TOKEN = OUTPUT_PRICE_USD_PER_MTOK / 1_000_000

export interface MonthlyUsage {
  /** Mês no formato yyyy-MM (rastreio reseta automaticamente em virada de mês). */
  month: string
  inputTokens: number
  outputTokens: number
  /** Custo total em USD usando preços do claude-sonnet-4-5. */
  costUsd: number
  /** Quantidade de perguntas (não de tool calls — é uma pergunta = um turn completo). */
  questionsCount: number
}

interface UsageState {
  /** Cache em memória pra evitar parsear localStorage a cada render. Keyed por redeId. */
  cache: Record<string, MonthlyUsage>
  /** Versão pra forçar re-render quando o cache atualiza. */
  version: number
  recordUsage: (redeId: string, inputTokens: number, outputTokens: number) => void
  getCurrentMonthUsage: (redeId: string) => MonthlyUsage
  resetMonth: (redeId: string) => void
}

const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const storageKey = (redeId: string, month: string) =>
  `${STORAGE_PREFIX}-${redeId}-${month}`

const emptyUsage = (): MonthlyUsage => ({
  month: monthKey(),
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  questionsCount: 0,
})

const readUsage = (redeId: string): MonthlyUsage => {
  if (typeof window === 'undefined') return emptyUsage()
  const month = monthKey()
  const raw = window.localStorage.getItem(storageKey(redeId, month))
  if (!raw) return emptyUsage()
  try {
    const parsed = JSON.parse(raw) as MonthlyUsage
    // Se o dado salvo é de outro mês (virada de mês), zera
    if (parsed.month !== month) return emptyUsage()
    return parsed
  } catch {
    return emptyUsage()
  }
}

const writeUsage = (redeId: string, usage: MonthlyUsage) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(redeId, usage.month), JSON.stringify(usage))
}

export const useUsageTracker = create<UsageState>((set, get) => ({
  cache: {},
  version: 0,
  recordUsage: (redeId, inputTokens, outputTokens) => {
    if (!redeId || (inputTokens === 0 && outputTokens === 0)) return
    const current = get().cache[redeId] ?? readUsage(redeId)
    // Se virou o mês entre o último write e agora, zera primeiro
    const base = current.month === monthKey() ? current : emptyUsage()
    const cost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
    const updated: MonthlyUsage = {
      month: base.month,
      inputTokens: base.inputTokens + inputTokens,
      outputTokens: base.outputTokens + outputTokens,
      costUsd: base.costUsd + cost,
      questionsCount: base.questionsCount + 1,
    }
    writeUsage(redeId, updated)
    set((s) => ({ cache: { ...s.cache, [redeId]: updated }, version: s.version + 1 }))
  },
  getCurrentMonthUsage: (redeId) => {
    if (!redeId) return emptyUsage()
    const cached = get().cache[redeId]
    if (cached && cached.month === monthKey()) return cached
    const fresh = readUsage(redeId)
    set((s) => ({ cache: { ...s.cache, [redeId]: fresh } }))
    return fresh
  },
  resetMonth: (redeId) => {
    if (!redeId || typeof window === 'undefined') return
    window.localStorage.removeItem(storageKey(redeId, monthKey()))
    set((s) => ({ cache: { ...s.cache, [redeId]: emptyUsage() }, version: s.version + 1 }))
  },
}))
