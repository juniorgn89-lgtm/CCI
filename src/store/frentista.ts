import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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

/**
 * Sessão do frentista persistida em localStorage. Necessário porque o
 * Supabase Auth restaura a sessão automaticamente em F5, mas os campos
 * derivados (funcionarioCodigo, nome, empresaCodigo, empresaNome) ficam
 * em memória — sem persist, ao recarregar a página /frentista o store fica
 * `session: null` e a tela trava em branco (`if (!session) return null`).
 *
 * O logout sempre chama clearSession explicitamente, então não fica lixo.
 */
export const useFreentistaStore = create<FreentistaStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: 'visor360.frentista-session',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
