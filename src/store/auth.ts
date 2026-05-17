import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Store global de autenticação Supabase.
 *
 * Estado é populado pelo bootstrap em App.tsx via `supabase.auth.getSession()` no
 * mount e mantido em sync por `supabase.auth.onAuthStateChange`. Componentes leem
 * dessa store de forma síncrona — nada de chamar Supabase direto na UI.
 */
interface AuthState {
  session: Session | null
  user: User | null
  /** True enquanto o getSession() inicial não retornou. Evita flash do /login. */
  isLoading: boolean
  /**
   * Lista de codigos de empresa permitidos pro user logado (vem de
   * `profiles.empresa_codigos`). `null` = sem restrição (vê todas da rede).
   * Componentes que mostram listas de postos consultam isso pra filtrar.
   */
  empresaCodigos: number[] | null
  /**
   * Lista de ids de módulos liberados pro user logado (vem de
   * `profiles.modulos_permitidos`). `null` ou vazio = sem restrição.
   * Sidebar e route guard usam pra esconder/bloquear módulos.
   */
  modulosPermitidos: string[] | null
  /** Gerente (CCI Consultoria) — sempre vê tudo, ignora as restrições. */
  isMaster: boolean
  setAuth: (session: Session | null) => void
  setEmpresaCodigos: (codigos: number[] | null) => void
  setModulosPermitidos: (modulos: string[] | null) => void
  setIsMaster: (isMaster: boolean) => void
  setLoaded: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  empresaCodigos: null,
  modulosPermitidos: null,
  isMaster: false,
  setAuth: (session) =>
    set({ session, user: session?.user ?? null, isLoading: false }),
  setEmpresaCodigos: (empresaCodigos) => set({ empresaCodigos }),
  setModulosPermitidos: (modulosPermitidos) => set({ modulosPermitidos }),
  setIsMaster: (isMaster) => set({ isMaster }),
  setLoaded: () => set({ isLoading: false }),
}))
