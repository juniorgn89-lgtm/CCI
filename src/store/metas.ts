import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MetasState {
  /** true → metas manuais; false → meta = mês anterior por frentista */
  manualMode: boolean
  /** funcionarioCodigo → meta em litros */
  metas: Record<number, number>
  setManualMode: (m: boolean) => void
  setMeta: (codigo: number, valor: number) => void
  resetMetas: () => void
}

export const useMetasStore = create<MetasState>()(
  persist(
    (set) => ({
      manualMode: false,
      metas: {},
      setManualMode: (manualMode) => set({ manualMode }),
      setMeta: (codigo, valor) =>
        set((state) => ({ metas: { ...state.metas, [codigo]: valor } })),
      resetMetas: () => set({ metas: {} }),
    }),
    { name: 'ccisga-metas' }
  )
)
