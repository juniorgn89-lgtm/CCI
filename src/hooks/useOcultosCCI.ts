import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAppOcultos, type AppOculto } from '@/api/supabase/appOcultos'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { tabKey } from '@/lib/appStructure'
import { fetchOcultosPessoas } from '@/api/supabase/appOcultosPessoas'

/** Ocultos POR PESSOA nesta rede (tela Ocultar módulos e abas › Por pessoa). */
export const ocultosPessoasKey = (redeId: string | null) => ['app-ocultos-pessoas', redeId] as const

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
 * rede aberta, mais o que foi escondido só para esta pessoa (Por pessoa). Somado aos outros filtros (permissão, plano, segmento,
 * personalização) nos mesmos pontos: AppLayout, Sidebar e usePersonalizedTabs.
 */
export const useOcultosCCI = (): OcultosCCI => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const { data } = useAppOcultos()
  // O que o diretor/supervisor escondeu só para ESTA pessoa nesta rede.
  const { data: pessoas } = useQuery({
    queryKey: ocultosPessoasKey(redeId),
    queryFn: () => fetchOcultosPessoas(redeId!),
    enabled: !!redeId && !!userId,
    staleTime: 5 * 60_000,
  })
  return useMemo(() => {
    const set = new Set((data ?? []).filter((o) => valeNaRede(o, redeId)).map((o) => o.chave))
    for (const o of pessoas ?? []) if (o.user_id === userId) set.add(o.chave)
    return {
      modulo: (path) => set.has(path),
      aba: (path, tabId) => set.has(tabKey(path, tabId)),
    }
  }, [data, redeId, pessoas, userId])
}
