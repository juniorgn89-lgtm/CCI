import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ComparisonMode = 'prevMonth' | 'prevYear'

interface FilterState {
  empresaCodigos: number[]
  dataInicial: string
  dataFinal: string
  /**
   * Modo de comparação dos KPIs: contra o mês anterior ou contra o mesmo
   * período do ano anterior. Default 'prevYear' mantém comportamento legado
   * da Central da Rede ("vs ano anterior"). Persistido pra que o usuário
   * mantenha sua preferência entre sessões.
   */
  comparisonMode: ComparisonMode
  setEmpresas: (codigos: number[]) => void
  setPeriodo: (dataInicial: string, dataFinal: string) => void
  setComparisonMode: (mode: ComparisonMode) => void
}

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()
const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
const lastDay = new Date(year, month + 1, 0)
const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      empresaCodigos: [],
      dataInicial: firstDay,
      dataFinal: lastDayStr,
      comparisonMode: 'prevYear',

      setEmpresas: (codigos) => {
        set({ empresaCodigos: codigos })
      },

      setPeriodo: (dataInicial, dataFinal) => {
        set({ dataInicial, dataFinal })
      },

      setComparisonMode: (comparisonMode) => {
        set({ comparisonMode })
      },
    }),
    {
      name: 'visor360-filters',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
