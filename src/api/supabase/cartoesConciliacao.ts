import { supabase } from '@/lib/supabase'

/**
 * Cartões · Conciliação — carimbo "tratado" (Fase 1).
 *
 * Tabela: cartoes_conciliacao_tratada (ver docs/supabase-cartoes-conciliacao.sql).
 * O gestor marca um item não conciliado como "já lancei no ERP" → some das
 * pendências. NÃO edita valor nem concilia — a conciliação determinística
 * continua sendo a verdade. Soft-delete auditável (desfeito_*).
 *
 * READ-ONLY vale pra API Quality, não pra tabelas internas do Supabase.
 * NUNCA envolver isto em `useMutation`; chamar direto de handlers.
 */

export interface TratadaRow {
  id: string
  rede_id: string
  empresa_codigo: number
  venda_codigo: number
  bandeira: string
  dia: string
  valor: number
  motivo: string
  observacao: string | null
  tratado_por: string | null
  tratado_por_nome: string
  tratado_em: string
  desfeito_por: string | null
  desfeito_por_nome: string | null
  desfeito_em: string | null
}

export interface MarcarTratadaInput {
  empresaCodigo: number
  vendaCodigo: number
  bandeira: string
  dia: string
  valor: number
  motivo: string
  observacao?: string
}

export interface TratadaContext {
  redeId: string
  userId: string
  userNome: string
}

/** Carimbos da rede (ativos + desfeitos) escopados por empresa. O componente
 *  decide o que fazer com os desfeitos. `empresaCodigos` vazio = toda a rede. */
export const fetchCartoesTratadas = async (
  redeId: string,
  empresaCodigos: number[],
): Promise<TratadaRow[]> => {
  if (!supabase) return []
  let q = supabase
    .from('cartoes_conciliacao_tratada')
    .select('*')
    .eq('rede_id', redeId)
    .order('tratado_em', { ascending: false })
    .limit(5000)
  if (empresaCodigos.length > 0) q = q.in('empresa_codigo', empresaCodigos)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TratadaRow[]
}

/** Carimba um item como tratado. Idempotente: se já houver carimbo ATIVO pra
 *  (rede, empresa, venda), o unique index parcial rejeita (23505) e ignoramos. */
export const marcarTratada = async (input: MarcarTratadaInput, ctx: TratadaContext): Promise<void> => {
  if (!supabase) return
  const { error } = await supabase.from('cartoes_conciliacao_tratada').insert({
    rede_id: ctx.redeId,
    empresa_codigo: input.empresaCodigo,
    venda_codigo: input.vendaCodigo,
    bandeira: input.bandeira,
    dia: input.dia,
    valor: input.valor,
    motivo: input.motivo,
    observacao: input.observacao ?? null,
    tratado_por: ctx.userId,
    tratado_por_nome: ctx.userNome,
  })
  if (error && error.code !== '23505') throw error
}

/** Desfaz um carimbo (soft-delete: preenche desfeito_*, mantém histórico). */
export const desfazerTratada = async (
  id: string,
  ctx: Pick<TratadaContext, 'userId' | 'userNome'>,
): Promise<void> => {
  if (!supabase) return
  const { error } = await supabase
    .from('cartoes_conciliacao_tratada')
    .update({
      desfeito_por: ctx.userId,
      desfeito_por_nome: ctx.userNome,
      desfeito_em: new Date().toISOString(),
    })
    .eq('id', id)
    .is('desfeito_em', null)
  if (error) throw error
}
