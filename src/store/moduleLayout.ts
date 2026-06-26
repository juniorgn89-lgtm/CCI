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
        // v18: aba "Pista" renomeada pra "Automotivo" (o migrate re-sincroniza o
        // label dos layouts persistidos a partir dos defaults).
        version: 18,
        migrate: (persisted, version) => {
          if (version < 6 || !persisted) return { tabs: defaultTabs }
          const state = persisted as { tabs: ModuleTab[] }
          const knownIds = defaultTabs.map((t) => t.id)
          const labelById = new Map(defaultTabs.map((t) => [t.id, t.label]))
          const existingIds = new Set(state.tabs.map((t) => t.id))
          const merged = [...state.tabs]
          for (const def of defaultTabs) {
            if (!existingIds.has(def.id)) merged.push(def)
          }
          return {
            tabs: merged
              .filter((t) => knownIds.includes(t.id))
              // Labels não são editáveis pelo usuário → re-sincroniza com os
              // defaults (preserva ordem/visibilidade que o user customizou).
              .map((t) => ({ ...t, label: labelById.get(t.id) ?? t.label })),
          }
        },
      }
    )
  )

/* ─── Module stores ─── */

// v15: Reabastecimento e Produtividade saíram da Central. v17: as 3 abas de
// Vendas (Combustível/Pista/Conveniência, por-posto) entraram na Central, que
// virou o hub único. O bump de versão acima força o migrate a re-sincronizar os
// layouts persistidos com estes defaults (adiciona ids novos, remove desconhecidos).
export const useDashboardLayout = createModuleLayoutStore('visor360-dashboard-layout', [
  { id: 'setor', label: 'Visão Geral', visible: true },
  { id: 'combustivel', label: 'Combustível', visible: true },
  { id: 'pista', label: 'Automotivo', visible: true },
  { id: 'conveniencia', label: 'Conveniência', visible: true },
  { id: 'aovivo', label: 'Ao Vivo Rede', visible: true },
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
  { id: 'mediaVendas', label: 'Média de venda (6m)', visible: true },
  { id: 'necessidade', label: 'Necessidade', visible: true },
])

// Bump no nome da store força reset pra essa aba específica (rename
// indicadores → visao não casaria com o merge do migrate).
export const useFinanceiroLayout = createModuleLayoutStore('visor360-financeiro-layout-v5', [
  { id: 'visao', label: 'Visão Geral', visible: true },
  { id: 'receber', label: 'Receber', visible: true },
  { id: 'pagar', label: 'Pagar', visible: true },
  { id: 'cartoes', label: 'Cartões', visible: true },
  { id: 'agenda', label: 'Agenda', visible: true },
])

// v16: Visão Geral saiu do Vendas (Combustível é o novo landing). O bump de
// versão acima força o migrate a derrubar a aba dos layouts já persistidos.
// -v2: consolidação do módulo — Visão Geral e Diferenças saíram (Diferenças virou
// o Panorama da Exceção). Storekey nova = defaults limpos pros usuários existentes,
// com Fechamento por exceção como 1ª aba (landing).
export const useCaixasLayout = createModuleLayoutStore('visor360-caixas-layout-v2', [
  { id: 'excecao', label: 'Fechamento por exceção', visible: true },
  { id: 'conferencia', label: 'Conferência por PDV', visible: true },
])

// -v2: reset limpo após trocar as sub-abas (Projeções/Metas/Destaques saíram;
// Frentistas/Vendedores viraram abas ao lado da Visão Geral).
export const useProdutividadeLayout = createModuleLayoutStore('visor360-produtividade-layout-v2', [
  { id: 'visao', label: 'Visão Geral', visible: true },
  { id: 'frentistas', label: 'Frentistas', visible: true },
  { id: 'vendedores', label: 'Vendedores', visible: true },
  { id: 'metas', label: 'Metas', visible: true },
])

// Inteligência não tem mais layout de abas: a Análise & Comparação foi removida
// e o Radar de Preços foi pro módulo Comercial — sobrou só o Cadu IA.

