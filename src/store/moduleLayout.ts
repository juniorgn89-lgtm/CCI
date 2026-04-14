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
        version: 4,
        migrate: (persisted, version) => {
          if (version < 4 || !persisted) return { tabs: defaultTabs }
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

export const useCombustiveisLayout = createModuleLayoutStore('ccisga-combustiveis-layout', [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'abastecimentos', label: 'Abastecimentos', visible: true },
  { id: 'diario', label: 'Dia a dia', visible: true },
  { id: 'tipo', label: 'Por combustível', visible: true },
  { id: 'lblitro', label: 'L.B./Litro', visible: true },
  { id: 'bombas', label: 'Por bomba', visible: true },
  { id: 'frentistas', label: 'Frentistas', visible: true },
])

export const useConvenienciasLayout = createModuleLayoutStore('ccisga-conveniencias-layout', [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'vendas', label: 'Vendas', visible: true },
  { id: 'catalogo', label: 'Catálogo', visible: true },
  { id: 'estoque', label: 'Estoque', visible: true },
  { id: 'topVendidos', label: 'Mais Vendidos', visible: true },
])

export const useEstoquesLayout = createModuleLayoutStore('ccisga-estoques-layout', [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'posicao', label: 'Posição', visible: true },
  { id: 'movimentacao', label: 'Movimentação', visible: true },
  { id: 'alertas', label: 'Alertas', visible: true },
  { id: 'historico', label: 'Histórico', visible: true },
  { id: 'analise', label: 'Análise', visible: true },
])

export const useFinanceiroLayout = createModuleLayoutStore('ccisga-financeiro-layout', [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'receber', label: 'Receber', visible: true },
  { id: 'pagar', label: 'Pagar', visible: true },
  { id: 'fluxo', label: 'Fluxo de Caixa', visible: true },
  { id: 'dre', label: 'DRE', visible: true },
])

export const useProdutosLayout = createModuleLayoutStore('ccisga-produtos-layout', [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'produtos', label: 'Produtos', visible: true },
  { id: 'top', label: 'Mais vendidos', visible: true },
  { id: 'pareto', label: 'Pareto', visible: true },
  { id: 'abc', label: 'Curva ABC', visible: true },
])

export const useOperacaoLayout = createModuleLayoutStore('ccisga-operacao-layout', [
  { id: 'indicadores', label: 'Indicadores', visible: true },
  { id: 'bombas', label: 'Bombas', visible: true },
  { id: 'abastecimentos', label: 'Abastecimentos', visible: true },
  { id: 'caixa', label: 'Caixa & Turnos', visible: true },
  { id: 'produtividade', label: 'Produtividade', visible: true },
])
