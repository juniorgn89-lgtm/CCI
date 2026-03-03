import { create } from 'zustand'

interface FilterState {
  empresaCodigo: number | null
  dataInicial: string
  dataFinal: string
  setEmpresa: (codigo: number | null) => void
  setPeriodo: (dataInicial: string, dataFinal: string) => void
}

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()
const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
const lastDay = new Date(year, month + 1, 0)
const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

export const useFilterStore = create<FilterState>((set) => ({
  empresaCodigo: null,
  dataInicial: firstDay,
  dataFinal: lastDayStr,

  setEmpresa: (codigo) => {
    set({ empresaCodigo: codigo })
  },

  setPeriodo: (dataInicial, dataFinal) => {
    set({ dataInicial, dataFinal })
  },
}))
