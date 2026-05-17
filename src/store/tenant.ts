import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Tenant atual — rede de postos cuja CHAVE Quality e base URL o app está
 * usando para todas as requisições. Persiste no localStorage pra que master
 * não precise reescolher a rede a cada reload.
 *
 * Para gerente (master): valor é populado pela tela /selecionar-rede.
 * Para supervisor/frentista: populado pelo bootstrap em App.tsx a partir
 * do rede_id do profile/frentistas (rede deles é fixa).
 *
 * Fallback: enquanto não houver `rede`, o client interceptor usa
 * VITE_API_KEY do env (compat durante migração).
 */
export interface Rede {
  id: string
  nome: string
  chave: string
  api_base_url: string
}

interface TenantState {
  rede: Rede | null
  isLoading: boolean
  setRede: (rede: Rede | null) => void
  setLoading: (v: boolean) => void
  clear: () => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      rede: null,
      isLoading: false,
      setRede: (rede) => set({ rede, isLoading: false }),
      setLoading: (v) => set({ isLoading: v }),
      clear: () => set({ rede: null, isLoading: false }),
    }),
    {
      name: 'ccisga-tenant',
      storage: createJSONStorage(() => localStorage),
      // isLoading não vale a pena persistir
      partialize: (state) => ({ rede: state.rede }),
    }
  )
)
