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
 *  - `logout()` → `signOut` + limpa o cache do React Query.
 *
 * Não tem signup público — usuários são criados pelo gerente via /admin/usuarios.
 * Frentista (código + PIN) usa useFrentistaAuth separado.
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
   * Lê a flag `approved` do profile do usuário atual. Filtra explicitamente por
   * user_id — necessário porque master pode ler N rows e `.single()` exige 1.
   */
  const isCurrentUserApproved = async (): Promise<boolean> => {
    if (!supabase) return false
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data, error } = await supabase
      .from('profiles')
      .select('approved')
      .eq('user_id', user.id)
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
    logout,
  }
}
