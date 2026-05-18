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

  /**
   * Troca a senha do usuário logado. Valida primeiro a senha atual via
   * re-autenticação (Supabase não exige isso na API, mas a UX é mais
   * segura quando o usuário precisa confirmar quem é antes de alterar).
   */
  const changePassword = useCallback(
    async (senhaAtual: string, senhaNova: string): Promise<{ ok: boolean; error?: string }> => {
      if (!supabase) return { ok: false, error: 'Supabase não configurado' }
      const email = user?.email
      if (!email) return { ok: false, error: 'Sessão expirada. Faça login novamente.' }

      // Re-autentica com a senha atual pra confirmar identidade
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: senhaAtual,
      })
      if (signErr) {
        return { ok: false, error: 'Senha atual incorreta' }
      }

      // Atualiza pra senha nova
      const { error: updErr } = await supabase.auth.updateUser({ password: senhaNova })
      if (updErr) return { ok: false, error: updErr.message }

      return { ok: true }
    },
    [user]
  )

  /**
   * Dispara o e-mail de redefinição de senha do Supabase. O link no email
   * volta pra /redefinir-senha onde o user define a nova senha.
   */
  const requestPasswordReset = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      if (!supabase) return { ok: false, error: 'Supabase não configurado' }
      const redirectTo = `${window.location.origin}/redefinir-senha`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },
    []
  )

  return {
    session,
    user,
    isAuthenticated: !!session,
    isLoading,
    error,
    login,
    logout,
    changePassword,
    requestPasswordReset,
  }
}
