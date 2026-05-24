import { supabase } from '@/lib/supabase'

/**
 * Helpers pra Qualidade de Dados — arquivamento de inconsistências.
 *
 * Tabela: qualidade_arquivados (ver docs/supabase-qualidade-arquivados.sql)
 *
 * Identidade lógica: (rede_id, empresa_codigo, tipo_issue, registro_codigo).
 * Unique index parcial garante que a mesma combinação não fique ativa duas vezes.
 *
 * IMPORTANTE: este módulo é o ÚNICO ponto do app que escreve no Supabase
 * fora do auth — a regra READ-ONLY da CLAUDE.md vale pra API Quality,
 * não pra tabelas internas do Supabase. NUNCA criar `useMutation` em volta
 * disso; chamar direto de event handlers.
 */

export interface ArquivadoRow {
  id: string
  rede_id: string
  empresa_codigo: number
  tipo_issue: string
  registro_codigo: string
  rotulo: string
  arquivado_por: string
  arquivado_por_nome: string
  arquivado_em: string
  restaurado_por: string | null
  restaurado_por_nome: string | null
  restaurado_em: string | null
}

export interface ArquivarInput {
  tipo_issue: string
  registro_codigo: string
  rotulo: string
}

export interface ArquivarContext {
  redeId: string
  empresaCodigo: number
  userId: string
  userNome: string
}

/**
 * Busca todos os arquivados (ativos + restaurados) da rede atual escopados
 * por empresa. O componente decide se filtra restaurados ou não.
 */
export const fetchQualidadeArquivados = async (
  redeId: string,
  empresaCodigo: number,
): Promise<ArquivadoRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('qualidade_arquivados')
    .select('*')
    .eq('rede_id', redeId)
    .eq('empresa_codigo', empresaCodigo)
    .order('arquivado_em', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []) as ArquivadoRow[]
}

/**
 * Arquiva N lançamentos em batch. Idempotente — se uma combinação já existe
 * como ativa, o insert falha e é silenciosamente ignorado (graças ao unique
 * index parcial). Insere os novos um a um pra que falhas isoladas não
 * propaguem; um insert em lote rejeitaria o batch inteiro.
 */
export const arquivarLancamentos = async (
  items: ArquivarInput[],
  ctx: ArquivarContext,
): Promise<{ arquivados: number; erros: number }> => {
  if (!supabase || items.length === 0) return { arquivados: 0, erros: 0 }
  let arquivados = 0
  let erros = 0
  for (const item of items) {
    const { error } = await supabase.from('qualidade_arquivados').insert({
      rede_id: ctx.redeId,
      empresa_codigo: ctx.empresaCodigo,
      tipo_issue: item.tipo_issue,
      registro_codigo: item.registro_codigo,
      rotulo: item.rotulo,
      arquivado_por: ctx.userId,
      arquivado_por_nome: ctx.userNome,
    })
    if (error) {
      // 23505 = unique_violation — já estava arquivado, OK ignorar
      if (error.code === '23505') continue
      console.warn('[qualidadeArquivados] insert error:', error.message)
      erros++
    } else {
      arquivados++
    }
  }
  return { arquivados, erros }
}

/**
 * Reabre (restaura) um arquivamento. Soft-restore: preenche restaurado_*
 * mas mantém a linha pra preservar histórico. O unique index parcial libera
 * a combinação pra ser re-arquivada se voltar a ser uma inconsistência.
 */
export const reabrirArquivado = async (
  arquivadoId: string,
  ctx: Pick<ArquivarContext, 'userId' | 'userNome'>,
): Promise<void> => {
  if (!supabase) return
  const { error } = await supabase
    .from('qualidade_arquivados')
    .update({
      restaurado_por: ctx.userId,
      restaurado_por_nome: ctx.userNome,
      restaurado_em: new Date().toISOString(),
    })
    .eq('id', arquivadoId)
    .is('restaurado_em', null) // só restaura se ainda estiver ativo
  if (error) throw error
}
