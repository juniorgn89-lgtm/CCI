import { supabase } from '@/lib/supabase'

/**
 * Manutenção das bombas (Supabase). Leitura = GET; escrita = INSERT/UPSERT
 * imperativo (sem useMutation). O histórico é append-only: correção é
 * soft-delete pelo master. Ver docs/supabase-manutencao-bombas.sql.
 */

export interface BombaManutencaoRow {
  id: string
  rede_id: string
  empresa_codigo: number
  bomba_codigo: number
  feita_em: string
  responsavel: string | null
  observacao: string | null
  created_by_nome: string | null
  created_at: string
  deleted_at: string | null
}

export interface ManutencaoConfigRow {
  rede_id: string
  empresa_codigo: number
  intervalo_litros: number
  avisar_pct: number
  responsavel: string | null
  updated_by_nome: string | null
  updated_at: string
}

export const fetchManutencoesPosto = async (redeId: string, empresaCodigo: number): Promise<BombaManutencaoRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('bomba_manutencoes')
    .select('*')
    .eq('rede_id', redeId)
    .eq('empresa_codigo', empresaCodigo)
    .is('deleted_at', null)
    .order('feita_em', { ascending: false })
  if (error) { console.warn('[manutencao] fetch error:', error.message); return [] }
  return (data ?? []) as BombaManutencaoRow[]
}

export const inserirManutencao = async (row: {
  rede_id: string
  empresa_codigo: number
  bomba_codigo: number
  feita_em: string
  responsavel: string | null
  observacao: string | null
  created_by_nome: string | null
}): Promise<{ ok: boolean; error?: string }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('bomba_manutencoes').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Correção (só master via RLS): marca o registro como excluído. */
export const excluirManutencao = async (id: string, porNome: string | null): Promise<{ ok: boolean; error?: string; count?: number }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  const { error, count } = await supabase
    .from('bomba_manutencoes')
    .update({ deleted_at: new Date().toISOString(), deleted_by_nome: porNome }, { count: 'exact' })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true, count: count ?? 0 }
}

export const fetchManutencaoConfigs = async (redeId: string): Promise<ManutencaoConfigRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase.from('manutencao_bombas_config').select('*').eq('rede_id', redeId)
  if (error) { console.warn('[manutencao] config fetch error:', error.message); return [] }
  return ((data ?? []) as ManutencaoConfigRow[]).map((r) => ({ ...r, intervalo_litros: Number(r.intervalo_litros), avisar_pct: Number(r.avisar_pct) }))
}

export const salvarManutencaoConfig = async (row: {
  rede_id: string
  empresa_codigo: number
  intervalo_litros: number
  avisar_pct: number
  responsavel: string | null
  updated_by_nome: string | null
}): Promise<{ ok: boolean; error?: string }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  const { error } = await supabase.from('manutencao_bombas_config').upsert(row, { onConflict: 'rede_id,empresa_codigo' })
  return error ? { ok: false, error: error.message } : { ok: true }
}
