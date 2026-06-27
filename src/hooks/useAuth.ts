import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { getLoginThrottleStatus, registerLoginFailure, resetLoginThrottle } from '@/lib/loginThrottle'

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
    // Acesso exige approved=true E ativo!=false. Usa select('*') de propósito:
    // não dá 400 quando a coluna `ativo` ainda não existe (pré-migration) — aí
    // `data.ativo` vem undefined e `!== false` trata como ATIVO (gate tolerante,
    // não trava ninguém antes de rodar a SQL).
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (error) return false
    return data?.approved === true && data?.ativo !== false
  }

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      if (!ensureClient() || !supabase) return

      const throttle = getLoginThrottleStatus()
      if (!throttle.allowed) {
        const mins = Math.ceil(throttle.retryAfterSeconds / 60)
        setError(`Muitas tentativas. Tente novamente em ${mins} min.`)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const status = registerLoginFailure()
        const msg = error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message
        if (status.remainingAttempts > 0 && status.remainingAttempts <= 2) {
          setError(`${msg} · ${status.remainingAttempts} tentativa(s) restante(s)`)
        } else if (!status.allowed) {
          const mins = Math.ceil(status.retryAfterSeconds / 60)
          setError(`Muitas tentativas. Tente novamente em ${mins} min.`)
        } else {
          setError(msg)
        }
        return
      }

      const approved = await isCurrentUserApproved()
      if (!approved) {
        await supabase.auth.signOut()
        setError('Sua conta está inativa ou aguardando aprovação do Gerente Geral.')
        return
      }

      resetLoginThrottle()
      // Mobile e desktop entram no MESMO app (shell responsivo via AppLayout).
      // O app Gerente legado (/gerente) segue no código, mas sem rota de entrada.
      navigate('/dashboard')
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
