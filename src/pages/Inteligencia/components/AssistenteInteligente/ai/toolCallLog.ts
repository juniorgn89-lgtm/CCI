import { create } from 'zustand'

/**
 * Store global de tool calls — alimenta o Monitor (subaba "Monitor") e os
 * KPIs de auditoria. Mantém só as últimas N entradas em memória (não persiste
 * em localStorage pra não esbarrar em quota com chat longo).
 */

export interface ToolCallLogEntry {
  id: string
  timestamp: string
  question: string
  tool: string
  args: Record<string, unknown>
  durationMs: number
  rowCount?: number
  ok: boolean
  error?: string
}

interface ToolCallLogState {
  entries: ToolCallLogEntry[]
  append: (entry: Omit<ToolCallLogEntry, 'id' | 'timestamp'>) => void
  clear: () => void
}

const MAX_ENTRIES = 200

export const useToolCallLog = create<ToolCallLogState>((set) => ({
  entries: [],
  append: (entry) =>
    set((state) => ({
      entries: [
        { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: new Date().toISOString() },
        ...state.entries,
      ].slice(0, MAX_ENTRIES),
    })),
  clear: () => set({ entries: [] }),
}))
