import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useTenantStore } from '@/store/tenant'
import { validateApiKey } from '../ai/claudeClient'
import type { RedeRow, AssistenteTier } from '@/api/supabase/redes'

/**
 * Hook do Assistente IA com config CENTRALIZADA pelo gerente do Visor360.
 *
 * Diferenças do antigo `useApiKey` (BYOK em localStorage):
 *  - Chave da Anthropic vem da rede CONECTADA (Supabase: redes.assistente_chave_anthropic)
 *  - Usuário final NÃO configura nada — só vê "ativo" ou "indisponível"
 *  - Validação roda automaticamente quando a rede troca ou quando a chave é atualizada no admin
 *
 * Status:
 *  - desabilitado: rede tem assistente_habilitado=false
 *  - sem-chave: habilitado=true mas chave vazia
 *  - validando: rodando ping na Anthropic
 *  - ativo: chave validada com 200
 *  - invalido: chave rejeitada (401/403/credit error)
 */

export type AssistenteStatus =
  | 'sem-rede'      // nenhuma rede conectada
  | 'desabilitado'  // rede conectada mas gerente desabilitou
  | 'sem-chave'     // habilitado mas chave vazia
  | 'validando'     // rodando validação
  | 'ativo'         // chave válida confirmada
  | 'invalido'      // chave rejeitada
  | 'erro'          // erro inesperado lendo a config

interface ValidationCache {
  byChave: Record<string, { status: AssistenteStatus; errorMessage: string | null; validatedAt: number }>
  setCache: (chave: string, entry: { status: AssistenteStatus; errorMessage: string | null; validatedAt: number }) => void
}

// Cache em memória pra não revalidar a mesma chave a cada render/mount.
// TTL implícito: enquanto a aba estiver aberta. Se admin trocar a chave,
// o id da rede no Supabase muda no fetch → cache da chave nova começa zerado.
const useValidationCache = create<ValidationCache>((set) => ({
  byChave: {},
  setCache: (chave, entry) =>
    set((state) => ({ byChave: { ...state.byChave, [chave]: entry } })),
}))

const fetchRedeConfig = async (redeId: string): Promise<RedeRow | null> => {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('redes')
    .select('*')
    .eq('id', redeId)
    .single()
  if (error) throw error
  return data as RedeRow | null
}

export const useRedeAssistente = () => {
  const tenantRede = useTenantStore((s) => s.rede)
  const { byChave, setCache } = useValidationCache()

  // Carrega a config completa da rede atual (com os campos do Assistente)
  const {
    data: redeConfig,
    isLoading: loadingConfig,
    error: configError,
    refetch,
  } = useQuery({
    queryKey: ['rede-assistente-config', tenantRede?.id],
    queryFn: () => (tenantRede?.id ? fetchRedeConfig(tenantRede.id) : Promise.resolve(null)),
    enabled: !!tenantRede?.id,
    staleTime: 60_000,
  })

  const chave = redeConfig?.assistente_chave_anthropic?.trim() || ''
  const habilitado = redeConfig?.assistente_habilitado ?? false
  const tier = (redeConfig?.assistente_tier ?? 'light') as AssistenteTier
  const cached = chave ? byChave[chave] : undefined

  // Quando a chave muda E ainda não foi validada nessa sessão → dispara validação
  useEffect(() => {
    if (!chave || !habilitado) return
    if (cached) return // já validado nessa sessão
    let cancelled = false
    setCache(chave, { status: 'validando', errorMessage: null, validatedAt: Date.now() })
    validateApiKey(chave).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setCache(chave, { status: 'ativo', errorMessage: null, validatedAt: Date.now() })
      } else {
        setCache(chave, {
          status: 'invalido',
          errorMessage: result.errorMessage ?? `HTTP ${result.status ?? '?'}`,
          validatedAt: Date.now(),
        })
      }
    })
    return () => { cancelled = true }
  }, [chave, habilitado, cached, setCache])

  // Computa status final
  let status: AssistenteStatus
  let errorMessage: string | null = null

  if (!tenantRede) {
    status = 'sem-rede'
  } else if (configError) {
    status = 'erro'
    errorMessage = (configError as Error).message
  } else if (loadingConfig) {
    status = 'validando'
  } else if (!habilitado) {
    status = 'desabilitado'
  } else if (!chave) {
    status = 'sem-chave'
  } else if (cached) {
    status = cached.status
    errorMessage = cached.errorMessage
  } else {
    status = 'validando'
  }

  const markInvalid = (msg?: string) => {
    if (!chave) return
    setCache(chave, {
      status: 'invalido',
      errorMessage: msg ?? 'Chave rejeitada pela Anthropic',
      validatedAt: Date.now(),
    })
  }

  return {
    /** Chave a ser usada pra chamar a Anthropic. Vazia se não disponível. */
    apiKey: status === 'ativo' ? chave : '',
    /** Status amigável pra UI. */
    status,
    errorMessage,
    /** Se o Assistente pode ser usado nessa rede agora mesmo. */
    isUsable: status === 'ativo',
    habilitado,
    tier,
    /** Nome da rede pra mostrar nas mensagens. */
    redeNome: tenantRede?.nome ?? null,
    /** Re-busca a config (útil depois que o admin edita). */
    refetchConfig: refetch,
    /** Marca a chave como inválida (chamado pelo chat ao receber 401). */
    markInvalid,
  }
}
