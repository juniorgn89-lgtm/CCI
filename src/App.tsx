import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRoutes from '@/routes'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      useAuthStore.getState().setAuth(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setAuth(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])
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
