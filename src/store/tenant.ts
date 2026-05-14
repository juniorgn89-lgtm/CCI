import { create } from 'zustand'

/**
 * Tenant atual — rede de postos cuja CHAVE Quality e base URL o app está
 * usando para todas as requisições. Populado pelo bootstrap em App.tsx
 * a partir do `rede_id` no profile (gerente) ou no frentistas (frentista).
 *
 * Fallback: enquanto não houver `rede` carregada, o client interceptor
 * usa `VITE_API_KEY` do env (mantido por compat durante migração).
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

export const useTenantStore = create<TenantState>((set) => ({
  rede: null,
  isLoading: false,
  setRede: (rede) => set({ rede, isLoading: false }),
  setLoading: (v) => set({ isLoading: v }),
  clear: () => set({ rede: null, isLoading: false }),
}))
