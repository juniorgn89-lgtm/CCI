import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SectionId = 'sectorKpis' | 'sectorDetails'

interface DashboardSection {
  id: SectionId
  label: string
  visible: boolean
}

const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: 'sectorKpis', label: 'KPIs por Setor', visible: true },
  { id: 'sectorDetails', label: 'Detalhamento por Setor', visible: true },
]

interface DashboardLayoutState {
  sections: DashboardSection[]
  toggleVisibility: (id: SectionId) => void
  moveUp: (id: SectionId) => void
  moveDown: (id: SectionId) => void
  reset: () => void
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      sections: DEFAULT_SECTIONS,

      toggleVisibility: (id) =>
        set((state) => ({
          sections: state.sections.map((s) =>
            s.id === id ? { ...s, visible: !s.visible } : s
          ),
        })),

      moveUp: (id) =>
        set((state) => {
          const index = state.sections.findIndex((s) => s.id === id)
          if (index <= 0) return state
          const next = [...state.sections]
          const temp = next[index - 1]
          next[index - 1] = next[index]
          next[index] = temp
          return { sections: next }
        }),

      moveDown: (id) =>
        set((state) => {
          const index = state.sections.findIndex((s) => s.id === id)
          if (index < 0 || index >= state.sections.length - 1) return state
          const next = [...state.sections]
          const temp = next[index + 1]
          next[index + 1] = next[index]
          next[index] = temp
          return { sections: next }
        }),

      reset: () => set({ sections: DEFAULT_SECTIONS }),
    }),
    {
      name: 'ccisga-dashboard-layout',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0 || !persisted) {
          return { sections: DEFAULT_SECTIONS }
        }
        // Ensure all known section IDs exist (for future additions)
        const state = persisted as { sections: DashboardSection[] }
        const knownIds = DEFAULT_SECTIONS.map((s) => s.id)
        const existingIds = new Set(state.sections.map((s) => s.id))
        const merged = [...state.sections]
        for (const def of DEFAULT_SECTIONS) {
          if (!existingIds.has(def.id)) {
            merged.push(def)
          }
        }
        // Remove sections that no longer exist
        const filtered = merged.filter((s) => knownIds.includes(s.id))
        return { sections: filtered }
      },
    }
  )
)

export type { SectionId, DashboardSection }
