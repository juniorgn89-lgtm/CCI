import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ModuleTab {
  id: string
  label: string
  visible: boolean
}

interface ModuleLayoutState {
  tabs: ModuleTab[]
  toggleVisibility: (id: string) => void
  moveUp: (id: string) => void
  moveDown: (id: string) => void
  reset: () => void
}

const createModuleLayoutStore = (storeName: string, defaultTabs: ModuleTab[]) =>
  create<ModuleLayoutState>()(
    persist(
      (set) => ({
        tabs: defaultTabs,

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

        reset: () => set({ tabs: defaultTabs }),
      }),
      {
        name: storeName,
        version: 8,
        migrate: (persisted, version) => {
          if (version < 6 || !persisted) return { tabs: defaultTabs }
          const state = persisted as { tabs: ModuleTab[] }
          const knownIds = defaultTabs.map((t) => t.id)
          const existingIds = new Set(state.tabs.map((t) => t.id))
          const merged = [...state.tabs]
          for (const def of defaultTabs) {
            if (!existingIds.has(def.id)) merged.push(def)
          }
          return { tabs: merged.filter((t) => knownIds.includes(t.id)) }
        },
      }
    )
  )

/* ─── Module stores ─── */

export const useDashboardLayout = createModuleLayoutStore('visor360-dashboard-layout', [
  { id: 'setor', label: 'Por Setor', visible: true },
  { id: 'aovivo', label: 'Ao Vivo Rede', visible: true },
  { id: 'reabastecimento', label: 'Reabastecimento', visible: true },
])

export const useConvenienciasLayout = createModuleLayoutStore('visor360-conveniencias-layout', [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'vendas', label: 'Vendas', visible: true },
  { id: 'catalogo', label: 'Catálogo', visible: true },
])

export const useEstoquesLayout = createModuleLayoutStore('visor360-estoques-layout', [
  { id: 'visao', label: 'Visão Geral', visible: true },
  { id: 'geral', label: 'Estoque geral', visible: true },
  { id: 'giro', label: 'Giro', visible: true },
  { id: 'estoqueMedio', label: 'Estoque médio', visible: true },
  { id: 'mediaVendas', label: 'Média de venda (6m)', visible: true },
  { id: 'necessidade', label: 'Necessidade', visible: true },
])

// Bump no nome da store força reset pra essa aba específica (rename
// indicadores → visao não casaria com o merge do migrate).
export const useFinanceiroLayout = createModuleLayoutStore('visor360-financeiro-layout-v2', [
  { id: 'visao', label: 'Visão Geral', visible: true },
  { id: 'receber', label: 'Receber', visible: true },
  { id: 'pagar', label: 'Pagar', visible: true },
  { id: 'fluxo', label: 'Fluxo de Caixa', visible: true },
])

