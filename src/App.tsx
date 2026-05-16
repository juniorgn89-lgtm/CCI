import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRoutes from '@/routes'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // 24h: mantém em memória entre navegações sem precisar refetch
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false, // evita storm de refetch quando wifi pisca
    },
  },
})

/**
 * Bootstrap da sessão Supabase. Roda uma vez no mount:
 *  - `getSession()` resolve a sessão persistida (cookies/localStorage do Supabase)
 *  - `onAuthStateChange` mantém a store em sync com login/logout/refresh de token
 *  - Sempre que a sessão muda, recarrega a Rede (tenant) do usuário pra ajustar
 *    a CHAVE Quality que o client interceptor injeta nas requisições.
 *
 * Se o client Supabase não estiver configurado (env vars faltando), `isLoading`
 * vira false imediatamente pra não bloquear o app — login via Supabase só não
 * vai funcionar até que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sejam setados.
 */
const useAuthBootstrap = () => {
  useEffect(() => {
    if (!supabase) {
      useAuthStore.getState().setLoaded()
      return
    }

    const handleSession = async (session: import('@supabase/supabase-js').Session | null) => {
      useAuthStore.getState().setAuth(session)
      if (!session) {
        useTenantStore.getState().clear()
        return
      }
      await loadTenantForUser()
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])
}

/**
 * Resolve a Rede do usuário logado. Filtra por user_id pra garantir 1 row
 * (master vê todos os profiles via RLS, então select.single() sem filtro
 * quebra). Tenta primeiro profiles (gerente/supervisor); fallback pra
 * frentistas (frentista logado via codigo+PIN).
 */
const loadTenantForUser = async () => {
  if (!supabase) return
  useTenantStore.getState().setLoading(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      useTenantStore.getState().setRede(null)
      return
    }

    // Tenta profile primeiro (gerente)
    const { data: profile } = await supabase
      .from('profiles')
      .select('rede_id, redes:rede_id ( id, nome, chave, api_base_url )')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile && (profile as Record<string, unknown>).redes) {
      const rede = (profile as { redes: { id: string; nome: string; chave: string; api_base_url: string } }).redes
      useTenantStore.getState().setRede(rede)
      return
    }

    // Frentista: lê da tabela frentistas
    const { data: frentista } = await supabase
      .from('frentistas')
      .select('rede_id, redes:rede_id ( id, nome, chave, api_base_url )')
      .eq('user_id', user.id)
      .maybeSingle()
    if (frentista && (frentista as Record<string, unknown>).redes) {
      const rede = (frentista as { redes: { id: string; nome: string; chave: string; api_base_url: string } }).redes
      useTenantStore.getState().setRede(rede)
      return
    }

    useTenantStore.getState().setRede(null)
  } catch {
    useTenantStore.getState().setRede(null)
  }
}

const App = () => {
  useAuthBootstrap()

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </BrowserRouter>
  )
}

export default App
