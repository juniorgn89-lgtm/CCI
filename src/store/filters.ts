import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ComparisonMode = 'prevMonth' | 'prevYear'

/**
 * Critério de data dos abastecimentos na Produtividade — espelha o filtro
 * Abast./Fiscal/Movimento do relatório de Abastecimento do webPosto:
 *  - ABAST: data/hora do abastecimento (quando o frentista de fato abasteceu)
 *  - FISCAL: data fiscal (turno/caixa fiscalizado) — é o que a apuração usa
 *  - MOVIMENTO: data de movimento do caixa
 * Default FISCAL → consistente com apuração/Central/Dashboard e usa o cache.
 */
export type AbastDateMode = 'ABAST' | 'FISCAL' | 'MOVIMENTO'

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
  /** Critério de data dos abastecimentos (Produtividade). Ver AbastDateMode. */
  abastDateMode: AbastDateMode
  setEmpresas: (codigos: number[]) => void
  setPeriodo: (dataInicial: string, dataFinal: string) => void
  setComparisonMode: (mode: ComparisonMode) => void
  setAbastDateMode: (mode: AbastDateMode) => void
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
      abastDateMode: 'FISCAL',

      setEmpresas: (codigos) => {
        set({ empresaCodigos: codigos })
      },

      setPeriodo: (dataInicial, dataFinal) => {
        set({ dataInicial, dataFinal })
      },

      setComparisonMode: (comparisonMode) => {
        set({ comparisonMode })
      },

      setAbastDateMode: (abastDateMode) => {
        set({ abastDateMode })
      },
    }),
    {
      name: 'visor360-filters',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
