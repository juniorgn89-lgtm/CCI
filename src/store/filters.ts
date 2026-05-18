import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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
  setEmpresas: (codigos: number[]) => void
  setPeriodo: (dataInicial: string, dataFinal: string) => void
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
    }),
    {
      name: 'ccisga-filters',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
