import { create } from 'zustand'

interface FreentistaSession {
  funcionarioCodigo: number
  nome: string
  empresaCodigo: number
  empresaNome: string
}

interface FreentistaStore {
  session: FreentistaSession | null
  setSession: (session: FreentistaSession) => void
  clearSession: () => void
}

export const useFreentistaStore = create<FreentistaStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
}))
