import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Store global de autenticação Supabase.
 *
 * Estado é populado pelo bootstrap em App.tsx via `supabase.auth.getSession()` no
 * mount e mantido em sync por `supabase.auth.onAuthStateChange`. Componentes leem
 * dessa store de forma síncrona — nada de chamar Supabase direto na UI.
 *
 * Note: frentista (login por código + PIN) ainda usa sessionStorage legacy.
 * Quando migrar pra Supabase (fase 2), `session` aqui vai cobrir ambos os fluxos.
 */
interface AuthState {
  session: Session | null
  user: User | null
  /** True enquanto o getSession() inicial não retornou. Evita flash do /login. */
  isLoading: boolean
  setAuth: (session: Session | null) => void
  setLoaded: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  setAuth: (session) => set({ session, user: session?.user ?? null, isLoading: false }),
  setLoaded: () => set({ isLoading: false }),
}))
