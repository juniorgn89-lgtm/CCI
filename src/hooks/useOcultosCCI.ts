import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAppOcultos, type AppOculto } from '@/api/supabase/appOcultos'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { tabKey } from '@/lib/appStructure'

export const OCULTOS_QUERY_KEY = ['app-ocultos'] as const

/** Lista crua (tela de ocultar). */
export const useAppOcultos = () => {
  const logado = useAuthStore((s) => !!s.user)
  return useQuery({ queryKey: OCULTOS_QUERY_KEY, queryFn: fetchAppOcultos, enabled: logado, staleTime: 5 * 60_000 })
}

export interface OcultosCCI {
  /** Módulo escondido pela CCI nesta rede? */
  modulo: (path: string) => boolean
  /** Aba escondida pela CCI nesta rede? */
  aba: (path: string, tabId: string) => boolean
}

const valeNaRede = (o: AppOculto, redeId: string | null) => o.redes == null || (!!redeId && o.redes.includes(redeId))

/**
 * O que a CCI escondeu (Painel › Parâmetros › Ocultar módulos e abas) para a
 * rede aberta. Somado aos outros filtros (permissão, plano, segmento,
 * personalização) nos mesmos pontos: AppLayout, Sidebar e usePersonalizedTabs.
 */
export const useOcultosCCI = (): OcultosCCI => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const { data } = useAppOcultos()
  return useMemo(() => {
    const set = new Set((data ?? []).filter((o) => valeNaRede(o, redeId)).map((o) => o.chave))
    return {
      modulo: (path) => set.has(path),
      aba: (path, tabId) => set.has(tabKey(path, tabId)),
    }
  }, [data, redeId])
}
