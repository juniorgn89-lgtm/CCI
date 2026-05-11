import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

/**
 * Aceita dois fluxos enquanto a migração não termina:
 *  - Supabase session (gerente, fluxo novo)
 *  - sessionStorage flag (frentista, fluxo legacy — vai sair na fase 2)
 *
 * Enquanto a sessão Supabase está sendo resolvida no boot, renderiza null
 * pra evitar flash do /login antes de descobrir que o usuário já está logado.
 */
const ProtectedRoute = () => {
  const { session, isLoading } = useAuthStore()

  if (isLoading) return null

  const hasSupabaseSession = !!session
  const hasLegacySession = sessionStorage.getItem('app_authenticated') === 'true'

  if (!hasSupabaseSession && !hasLegacySession) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
