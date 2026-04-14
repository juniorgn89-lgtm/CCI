import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type TabId = 'indicadores' | 'bombas' | 'abastecimentos' | 'caixa' | 'produtividade'

interface OperacaoTab {
  id: TabId
  label: string
  visible: boolean
}

const DEFAULT_TABS: OperacaoTab[] = [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'bombas', label: 'Bombas', visible: true },
  { id: 'abastecimentos', label: 'Abastecimentos', visible: true },
  { id: 'caixa', label: 'Caixa & Turnos', visible: true },
  { id: 'produtividade', label: 'Produtividade', visible: true },
]

interface OperacaoLayoutState {
  tabs: OperacaoTab[]
  toggleVisibility: (id: TabId) => void
  moveUp: (id: TabId) => void
  moveDown: (id: TabId) => void
  reset: () => void
}

export const useOperacaoLayoutStore = create<OperacaoLayoutState>()(
  persist(
    (set) => ({
      tabs: DEFAULT_TABS,

      toggleVisibility: (id) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, visible: !t.visible } : t
          ),
        })),

      moveUp: (id) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === id)
          if (index <= 0) return state
          const next = [...state.tabs]
          const temp = next[index - 1]
          next[index - 1] = next[index]
          next[index] = temp
          return { tabs: next }
        }),

      moveDown: (id) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === id)
          if (index < 0 || index >= state.tabs.length - 1) return state
          const next = [...state.tabs]
          const temp = next[index + 1]
          next[index + 1] = next[index]
          next[index] = temp
          return { tabs: next }
        }),

      reset: () => set({ tabs: DEFAULT_TABS }),
    }),
    {
      name: 'ccisga-operacao-layout',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0 || !persisted) {
          return { tabs: DEFAULT_TABS }
        }
        const state = persisted as { tabs: OperacaoTab[] }
        const knownIds = DEFAULT_TABS.map((t) => t.id)
        const existingIds = new Set(state.tabs.map((t) => t.id))
        const merged = [...state.tabs]
        for (const def of DEFAULT_TABS) {
          if (!existingIds.has(def.id)) merged.push(def)
        }
        return { tabs: merged.filter((t) => knownIds.includes(t.id)) }
      },
    }
  )
)

export type { TabId, OperacaoTab }
