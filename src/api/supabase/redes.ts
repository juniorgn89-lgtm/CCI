import { supabase } from '@/lib/supabase'

export interface RedeRow {
  id: string
  nome: string
  chave: string
  api_base_url: string
  ativo: boolean
  created_at: string
  updated_at: string
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
}

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
