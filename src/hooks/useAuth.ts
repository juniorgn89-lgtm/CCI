import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

/**
 * Hook de auth do gerente — wrapper fino sobre Supabase Auth + auth store.
 *
 * Flow:
 *  - `login(email, password)` → `supabase.auth.signInWithPassword` → store atualiza
 *    via listener no App.tsx → navega pra dashboard/gerente conforme tamanho da tela
 *  - `signup(email, password, fullName)` → `supabase.auth.signUp` (full_name vai
 *    em `user_metadata`). Se "Confirm email" estiver desativado no Supabase, vira
 *    sessão imediata e cai no mesmo flow do login.
 *  - `logout()` → `signOut` + limpa o cache do React Query pra não vazar dados
 *    do usuário anterior na próxima sessão.
 *
 * Fluxo do frentista (código + PIN) NÃO usa esse hook — continua no Login direto
 * com sessionStorage legacy até a fase 2 da migração.
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

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      if (!ensureClient() || !supabase) return

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message)
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
        return { needsEmailConfirmation: false }
      }

      // Se "Confirm email" estiver desativado no Supabase, já vem sessão e o usuário
      // pode entrar direto. Caso contrário, sessão fica null até confirmar pelo email.
      if (data.session) {
        const isMobile = window.innerWidth < 768
        navigate(isMobile ? '/gerente' : '/dashboard')
        return { needsEmailConfirmation: false }
      }

      return { needsEmailConfirmation: true }
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
