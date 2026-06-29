import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRoutes from '@/routes'
import PwaUpdatePrompt from '@/components/feedback/PwaUpdatePrompt'
import { initPerf } from '@/lib/perf/initPerf'
import { PerfScreenTracker, PerfProfiler } from '@/lib/perf/PerfInstruments'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { todayLocal } from '@/lib/period'

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
        useAuthStore.getState().setEmpresaCodigos(null)
        useAuthStore.getState().setModulosPermitidos(null)
        useAuthStore.getState().setIsMaster(false)
        useAuthStore.getState().setCanApurar(false)
        useAuthStore.getState().setCanVerReabastecimento(false)
        useAuthStore.getState().setFullName(null)
        // Limpa filtro global de empresa pra não vazar contexto entre sessões
        // (ex: Keidma sai → Junior entra → não herda o POSTO ITAPOA dela).
        useFilterStore.getState().setEmpresas([])
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
      .select('rede_id, full_name, empresa_codigos, modulos_permitidos, is_master, pode_apurar, pode_ver_reabastecimento, onboarding_seen, redes:rede_id ( id, nome, chave, api_base_url )')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile) {
      // Supabase infere o join `redes:rede_id` como array, mas a relação é
      // to-one (retorna objeto em runtime) — cast via unknown pra alinhar.
      const typed = profile as unknown as {
        full_name: string | null
        empresa_codigos: number[] | null
        modulos_permitidos: string[] | null
        is_master: boolean | null
        pode_apurar: boolean | null
        pode_ver_reabastecimento: boolean | null
        onboarding_seen: boolean | null
        redes: { id: string; nome: string; chave: string; api_base_url: string } | null
      }
      const isMaster = !!typed.is_master
      // Master NUNCA tem rede auto-carregada do profile — a escolha é feita
      // em /selecionar-rede e persistida no localStorage (zustand persist).
      // Isso evita disparar queries pra uma rede "default" indesejada quando
      // ele tem várias e quer só usar /admin.
      if (!isMaster) {
        useTenantStore.getState().setRede(typed.redes ?? null)
      }
      useAuthStore.getState().setEmpresaCodigos(typed.empresa_codigos)
      useAuthStore.getState().setModulosPermitidos(typed.modulos_permitidos)
      useAuthStore.getState().setIsMaster(isMaster)
      // Master sempre tem o poder de apurar; pra outros, lê o flag do profile.
      useAuthStore.getState().setCanApurar(isMaster || !!typed.pode_apurar)
      useAuthStore.getState().setCanVerReabastecimento(isMaster || !!typed.pode_ver_reabastecimento)
      // Nome de exibição vem do profile (fonte da verdade do app), evita ficar
      // exibindo o user_metadata.full_name antigo do Supabase auth.
      useAuthStore.getState().setFullName(typed.full_name)
      useAuthStore.getState().setOnboardingSeen(!!typed.onboarding_seen)
      // Briefing matinal: query SEPARADA e resiliente — a coluna last_briefing_date
      // pode não existir ainda (docs/supabase-briefing.sql não rodada). Um erro
      // aqui NÃO quebra o login; só mantém o briefing oculto (default `true`).
      const { data: br, error: brErr } = await supabase
        .from('profiles').select('last_briefing_date').eq('user_id', user.id).maybeSingle()
      if (!brErr && br) {
        const lastBriefing = (br as { last_briefing_date: string | null }).last_briefing_date
        useAuthStore.getState().setBriefingSeenToday(lastBriefing === todayLocal())
      }
      // Acesso multi-rede — query SEPARADA e resiliente (as colunas podem não
      // existir ainda; docs/supabase-usuario-redes.sql). Erro aqui NÃO quebra o
      // login: cai no default (sem switch, comportamento legado de 1 rede).
      const { data: ar, error: arErr } = await supabase
        .from('profiles').select('redes_permitidas, acesso_todas_redes').eq('user_id', user.id).maybeSingle()
      if (!arErr && ar) {
        const a = ar as { redes_permitidas: string[] | null; acesso_todas_redes: boolean | null }
        useAuthStore.getState().setAcessoRedes(!!a.acesso_todas_redes, a.redes_permitidas ?? [])
      }
      return
    }

    // Frentista: lê da tabela frentistas (frentista vê só o próprio posto)
    const { data: frentista } = await supabase
      .from('frentistas')
      .select('rede_id, empresa_codigo, redes:rede_id ( id, nome, chave, api_base_url )')
      .eq('user_id', user.id)
      .maybeSingle()
    if (frentista && (frentista as Record<string, unknown>).redes) {
      // Mesmo caso do profile: join to-one inferido como array.
      const typed = frentista as unknown as {
        empresa_codigo: number
        redes: { id: string; nome: string; chave: string; api_base_url: string }
      }
      useTenantStore.getState().setRede(typed.redes)
      // Frentista é sempre restrito ao próprio posto
      useAuthStore.getState().setEmpresaCodigos([typed.empresa_codigo])
      useAuthStore.getState().setModulosPermitidos(null)
      useAuthStore.getState().setIsMaster(false)
      useAuthStore.getState().setCanApurar(false)
      useAuthStore.getState().setCanVerReabastecimento(false)
      return
    }

    useTenantStore.getState().setRede(null)
    useAuthStore.getState().setEmpresaCodigos(null)
    useAuthStore.getState().setModulosPermitidos(null)
    useAuthStore.getState().setIsMaster(false)
    useAuthStore.getState().setCanApurar(false)
    useAuthStore.getState().setCanVerReabastecimento(false)
  } catch {
    useTenantStore.getState().setRede(null)
    useAuthStore.getState().setEmpresaCodigos(null)
    useAuthStore.getState().setModulosPermitidos(null)
    useAuthStore.getState().setIsMaster(false)
    useAuthStore.getState().setCanApurar(false)
    useAuthStore.getState().setCanVerReabastecimento(false)
  }
}

const App = () => {
  useAuthBootstrap()
  // Harness de medição de performance (no-op sem a flag visor360.perf).
  useEffect(() => { initPerf() }, [])

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <PerfScreenTracker />
        <PerfProfiler id="page">
          <AppRoutes />
        </PerfProfiler>
        <PwaUpdatePrompt />
      </QueryClientProvider>
    </BrowserRouter>
  )
}

export default App
