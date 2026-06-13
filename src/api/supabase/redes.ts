import axios from 'axios'
import { supabase } from '@/lib/supabase'

export type AssistenteTier = 'light' | 'medium' | 'heavy' | 'custom'

export interface RedeRow {
  id: string
  nome: string
  chave: string
  api_base_url: string
  ativo: boolean
  /** Apuração automática (cron diário) ligada pra esta rede. Default true. */
  apuracao_auto?: boolean
  created_at: string
  updated_at: string
  /* ─── Assistente IA · configuração por rede (migration: supabase-assistente-config.sql) ─── */
  assistente_habilitado?: boolean
  assistente_tier?: AssistenteTier
  assistente_limite_mensal_usd?: number | null
  assistente_observacoes?: string | null
  assistente_workspace_id?: string | null
  assistente_contato_email?: string | null
  assistente_atualizado_em?: string | null
  /** Chave da Anthropic configurada pelo gerente (gestão central, não BYOK). */
  assistente_chave_anthropic?: string | null
}

interface QualityEmpresasResponse {
  resultados?: Array<{ codigo: number }>
}

/**
 * Conta quantos postos a rede tem na Quality, chamando o endpoint /EMPRESAS
 * com a CHAVE dela. Bypassa o client global (que usa o tenant ativo) pra
 * permitir que o master conte simultaneamente várias redes diferentes.
 *
 * Em erro (rede com CHAVE inválida, Quality fora do ar), retorna null pra
 * sinalizar "não foi possível contar" — o caller esconde o número em vez
 * de mostrar 0 enganoso.
 */
export const fetchEmpresasCountForRede = async (rede: RedeRow): Promise<number | null> => {
  try {
    const res = await axios.get<QualityEmpresasResponse>(`${rede.api_base_url}/EMPRESAS`, {
      params: { CHAVE: rede.chave, limite: 500 },
      timeout: 15_000,
    })
    return res.data?.resultados?.length ?? 0
  } catch {
    return null
  }
}

export const fetchRedes = async (): Promise<RedeRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('redes')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as RedeRow[]
}

interface CreateRedeInput {
  nome: string
  chave: string
  api_base_url?: string
}

export const createRede = async (input: CreateRedeInput): Promise<RedeRow> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase
    .from('redes')
    .insert({
      nome: input.nome,
      chave: input.chave,
      api_base_url: input.api_base_url || 'https://web.qualityautomacao.com.br/INTEGRACAO',
    })
    .select()
    .single()
  if (error) throw error
  return data as RedeRow
}

interface UpdateRedeInput {
  nome?: string
  chave?: string
  api_base_url?: string
  ativo?: boolean
  apuracao_auto?: boolean
  assistente_habilitado?: boolean
  assistente_tier?: AssistenteTier
  assistente_limite_mensal_usd?: number | null
  assistente_observacoes?: string | null
  assistente_workspace_id?: string | null
  assistente_contato_email?: string | null
  assistente_atualizado_em?: string | null
  assistente_chave_anthropic?: string | null
}

/**
 * Atualiza apenas a configuração do Assistente IA de uma rede. Sempre carimba
 * `assistente_atualizado_em = now()` pra rastrear quando foi a última mudança.
 */
export const updateAssistenteConfig = (
  id: string,
  patch: Pick<
    UpdateRedeInput,
    | 'assistente_habilitado'
    | 'assistente_tier'
    | 'assistente_limite_mensal_usd'
    | 'assistente_observacoes'
    | 'assistente_workspace_id'
    | 'assistente_contato_email'
    | 'assistente_chave_anthropic'
  >,
) =>
  updateRede(id, { ...patch, assistente_atualizado_em: new Date().toISOString() })

export const updateRede = async (id: string, patch: UpdateRedeInput): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('redes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export const toggleRedeAtivo = (id: string, ativo: boolean) =>
  updateRede(id, { ativo })

/** Liga/desliga a apuração automática (cron diário) de uma rede. */
export const toggleRedeApuracaoAuto = (id: string, apuracao_auto: boolean) =>
  updateRede(id, { apuracao_auto })

/** Lê só a flag de apuração automática da rede (default true se a coluna for null). */
export const fetchRedeApuracaoAuto = async (id: string): Promise<boolean> => {
  if (!supabase) return true
  const { data, error } = await supabase.from('redes').select('apuracao_auto').eq('id', id).single()
  if (error) return true
  return (data as { apuracao_auto?: boolean } | null)?.apuracao_auto ?? true
}

/**
 * Exclui uma rede do sistema. Operação irreversível.
 *
 * Os profiles vinculados via `rede_id` permanecem (FK com ON DELETE SET NULL
 * ou similar — depende do schema). O histórico de apuração (apuracao_diaria,
 * apuracao_abastecimentos, etc.) é mantido órfão pra auditoria, a menos que
 * o schema tenha CASCADE.
 *
 * Se houver FK sem cascade configurado, o Supabase retorna erro (ex:
 * "violates foreign key constraint") e o caller exibe pro usuário.
 */
export const deleteRede = async (id: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.from('redes').delete().eq('id', id)
  if (error) throw error
}
