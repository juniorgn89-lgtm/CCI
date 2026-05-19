import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ComparisonMode = 'prevMonth' | 'prevYear'

interface FilterState {
  empresaCodigos: number[]
  dataInicial: string
  dataFinal: string
  /**
   * Memória do último posto único filtrado — usada pelo toggle
   * "Central da Rede ⇄ Posto" do Dashboard. Sobrevive entre navegações
   * e reloads pra que o usuário consiga voltar pro posto que tava vendo
   * sem precisar reabrir o dropdown.
   */
  lastSingleEmpresaCodigo: number | null
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
      lastSingleEmpresaCodigo: null,
      comparisonMode: 'prevYear',

      setEmpresas: (codigos) => {
        set((state) => ({
          empresaCodigos: codigos,
          // Atualiza memória só quando a seleção é de um único posto.
          // Clicar em "Central" (codigos=[]) preserva a memória anterior.
          lastSingleEmpresaCodigo:
            codigos.length === 1 ? codigos[0] : state.lastSingleEmpresaCodigo,
        }))
      },

      setPeriodo: (dataInicial, dataFinal) => {
        set({ dataInicial, dataFinal })
      },

      setComparisonMode: (comparisonMode) => {
        set({ comparisonMode })
      },
    }),
    {
      name: 'ccisga-filters',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
