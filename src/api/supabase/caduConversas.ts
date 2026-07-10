import { supabase } from '@/lib/supabase'
import type { UiChatMessage } from '@/pages/Inteligencia/components/AssistenteInteligente/ai/types'

/**
 * Persistência das conversas do Cadu (Assistente IA).
 *
 * Tabela: cadu_conversas (ver docs/supabase-cadu-conversas.sql).
 * 1 linha por conversa; as mensagens ficam num jsonb (UiChatMessage[]).
 * RLS garante que cada usuário só vê/edita as próprias conversas.
 *
 * READ-ONLY note: a regra GET-only da CLAUDE.md vale pra API Quality, NÃO pra
 * tabelas internas do Supabase. Chamar direto de handlers — sem useMutation.
 */

export interface CaduConversaRow {
  id: string
  rede_id: string
  user_id: string
  titulo: string
  mensagens: UiChatMessage[]
  created_at: string
  updated_at: string
}

export interface SaveCaduConversaInput {
  /** Quando ausente, cria uma nova conversa (id gerado pelo banco). */
  id?: string
  redeId: string
  userId: string
  titulo: string
  mensagens: UiChatMessage[]
}

/** Conversas da rede+usuário, mais recentes primeiro. */
export const listCaduConversas = async (
  redeId: string,
  userId: string,
): Promise<CaduConversaRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('cadu_conversas')
    .select('*')
    .eq('rede_id', redeId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) {
    console.warn('[caduConversas] list error:', error.message)
    return []
  }
  return (data ?? []) as CaduConversaRow[]
}

/** Upsert: cria (sem id) ou atualiza (com id) a conversa. Retorna o id salvo. */
export const saveCaduConversa = async (
  input: SaveCaduConversaInput,
): Promise<string | null> => {
  if (!supabase) return null
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    rede_id: input.redeId,
    user_id: input.userId,
    titulo: input.titulo,
    mensagens: input.mensagens,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('cadu_conversas')
    .upsert(payload, { onConflict: 'id' })
    .select('id')
    .single()
  if (error) {
    console.warn('[caduConversas] save error:', error.message)
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

/** Renomeia uma conversa (só o título; não mexe na ordem/updated_at). */
export const renameCaduConversa = async (id: string, titulo: string): Promise<void> => {
  if (!supabase) return
  const { error } = await supabase.from('cadu_conversas').update({ titulo }).eq('id', id)
  if (error) console.warn('[caduConversas] rename error:', error.message)
}

export const deleteCaduConversa = async (id: string): Promise<void> => {
  if (!supabase) return
  const { error } = await supabase.from('cadu_conversas').delete().eq('id', id)
  if (error) console.warn('[caduConversas] delete error:', error.message)
}
