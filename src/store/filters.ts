import { create } from 'zustand'

interface FilterState {
  empresaCodigos: number[]
  dataInicial: string
  dataFinal: string
  setEmpresas: (codigos: number[]) => void
  setPeriodo: (dataInicial: string, dataFinal: string) => void
}

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()
const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
const lastDay = new Date(year, month + 1, 0)
const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

export const useFilterStore = create<FilterState>((set) => ({
  empresaCodigos: [],
  dataInicial: firstDay,
  dataFinal: lastDayStr,

  setEmpresas: (codigos) => {
    set({ empresaCodigos: codigos })
  },

  setPeriodo: (dataInicial, dataFinal) => {
    set({ dataInicial, dataFinal })
  },
}))
