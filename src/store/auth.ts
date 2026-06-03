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
  /**
   * Permissão pra acessar /admin/apuracao. Master sempre pode; supervisor/user
   * apenas quando profile.pode_apurar=true (granted pelo master).
   */
  canApurar: boolean
  /**
   * Permissão pra ver o painel de Reabastecimento na Central da Rede.
   * Master sempre pode; supervisor/user só com flag.
   */
  canVerReabastecimento: boolean
  /**
   * Nome de exibição do usuário (de `profiles.full_name`). Usado no avatar
   * da sidebar e em qualquer lugar que mostre quem está logado. Quando null,
   * UI cai pra `user_metadata.full_name` ou email.
   */
  fullName: string | null
  /**
   * Se o usuário já viu o tour de boas-vindas (de `profiles.onboarding_seen`).
   * Default `true` (não mostra) até o bootstrap confirmar `false` pro perfil —
   * evita flash. Persistido por USUÁRIO no Supabase (não por dispositivo).
   */
  onboardingSeen: boolean
  setAuth: (session: Session | null) => void
  setEmpresaCodigos: (codigos: number[] | null) => void
  setModulosPermitidos: (modulos: string[] | null) => void
  setIsMaster: (isMaster: boolean) => void
  setCanApurar: (canApurar: boolean) => void
  setCanVerReabastecimento: (v: boolean) => void
  setFullName: (name: string | null) => void
  setOnboardingSeen: (v: boolean) => void
  setLoaded: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  empresaCodigos: null,
  modulosPermitidos: null,
  isMaster: false,
  canApurar: false,
  canVerReabastecimento: false,
  fullName: null,
  onboardingSeen: true,
  setAuth: (session) =>
    set({ session, user: session?.user ?? null, isLoading: false }),
  setEmpresaCodigos: (empresaCodigos) => set({ empresaCodigos }),
  setModulosPermitidos: (modulosPermitidos) => set({ modulosPermitidos }),
  setIsMaster: (isMaster) => set({ isMaster }),
  setCanApurar: (canApurar) => set({ canApurar }),
  setCanVerReabastecimento: (canVerReabastecimento) => set({ canVerReabastecimento }),
  setFullName: (fullName) => set({ fullName }),
  setOnboardingSeen: (onboardingSeen) => set({ onboardingSeen }),
  setLoaded: () => set({ isLoading: false }),
}))
