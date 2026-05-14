import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

/**
 * Hook de auth do gerente — wrapper fino sobre Supabase Auth + auth store.
 *
 * Flow:
 *  - `login(email, password)` → `signInWithPassword` → checa flag `approved` em
 *    `public.profiles`. Se não aprovado, faz signOut imediato + setError.
 *  - `signup(email, password, fullName)` → `signUp` (full_name vai em metadata).
 *    Pós-signup pode resultar em 3 estados: aguardando email confirm, aguardando
 *    aprovação do supervisor, ou logado e aprovado (e navega).
 *  - `logout()` → `signOut` + limpa o cache do React Query.
 *
 * Frentista (código + PIN) NÃO usa esse hook — continua no Login direto até fase 2.
 */
export const useAuth = () => {
  const { session, user, isLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const ensureClient = () => {
    if (!supabase) {
      setError(
        'Supabase não configurado. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.'
      )
      return false
    }
    return true
  }

  /**
   * Lê a flag `approved` do profile do usuário atual. Retorna false se profile
   * não existe (defensivo — não devia acontecer porque o trigger sempre cria).
   */
  const isCurrentUserApproved = async (): Promise<boolean> => {
    if (!supabase) return false
    const { data, error } = await supabase
      .from('profiles')
      .select('approved')
      .single()
    if (error) return false
    return data?.approved === true
  }

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      if (!ensureClient() || !supabase) return

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message)
        return
      }

      const approved = await isCurrentUserApproved()
      if (!approved) {
        await supabase.auth.signOut()
        setError('Sua conta está aguardando aprovação da CCI Consultoria.')
        return
      }

      const isMobile = window.innerWidth < 768
      navigate(isMobile ? '/gerente' : '/dashboard')
    },
    [navigate]
  )

  const signup = useCallback(
    async (email: string, password: string, fullName: string) => {
      setError(null)
      if (!ensureClient() || !supabase) return

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) {
        setError(error.message)
        return { needsEmailConfirmation: false, needsApproval: false }
      }

      // Sessão null → "Confirm email" tá ativo no Supabase, usuário precisa
      // confirmar pelo email antes de conseguir logar.
      if (!data.session) {
        return { needsEmailConfirmation: true, needsApproval: false }
      }

      // Sessão imediata → checa se o profile já está aprovado.
      // Supervisor (contato@cci.app.br) é auto-aprovado pelo trigger.
      const approved = await isCurrentUserApproved()
      if (!approved) {
        await supabase.auth.signOut()
        return { needsEmailConfirmation: false, needsApproval: true }
      }

      const isMobile = window.innerWidth < 768
      navigate(isMobile ? '/gerente' : '/dashboard')
      return { needsEmailConfirmation: false, needsApproval: false }
    },
    [navigate]
  )

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    // Limpa também o legacy flag — defensivo, cobre caso de gerente que ainda
    // tinha sessionStorage do fluxo antigo
    sessionStorage.removeItem('app_authenticated')
    sessionStorage.removeItem('app_mode')
    queryClient.clear()
    navigate('/login')
  }, [navigate, queryClient])

  return {
    session,
    user,
    isAuthenticated: !!session,
    isLoading,
    error,
    login,
    signup,
    logout,
  }
}
