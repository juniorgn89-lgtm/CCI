import { supabase } from '@/lib/supabase'

/**
 * Compliance ANP — justificativas de reajuste (Fase 2, MVP).
 *
 * Tabela append-only `compliance_justificativas` (ver
 * docs/supabase-compliance-justificativas.sql) = trilha de AUDITORIA da defesa:
 * cada reajuste de preço pode ganhar uma justificativa documentada, imutável.
 *
 * READ-ONLY vale só pra API Quality — gravar no Supabase é permitido (igual
 * apuração/conciliação/qualidade-arquivados). NUNCA envolver em useMutation;
 * chamar direto de event handlers.
 */

export interface ComplianceJustificativa {
  id: string
  rede_id: string
  empresa_codigo: number
  produto_codigo: number
  troca_data: string
  troca_preco_novo: number | null
  preco_antigo: number | null
  custo_referencia: number | null
  justificativa: string
  criado_por: string | null
  criado_por_nome: string | null
  criado_em: string
}

export interface AddJustificativaInput {
  empresaCodigo: number
  produtoCodigo: number
  /** Dia do reajuste (yyyy-MM-dd) — parte da chave lógica com empresa+produto. */
  trocaData: string
  trocaPrecoNovo: number | null
  precoAntigo: number | null
  custoReferencia: number | null
  justificativa: string
}

export interface JustificativaContext {
  redeId: string
  userId: string
  userNome: string
}

/** Chave lógica pra casar uma justificativa com uma linha do log de troca. */
export const justificativaKey = (empresaCodigo: number, produtoCodigo: number, trocaData: string): string =>
  `${empresaCodigo}|${produtoCodigo}|${trocaData.slice(0, 10)}`

/** Justificativas da rede escopadas por posto(s) — pro lookup do log de troca. */
export const fetchComplianceJustificativas = async (
  redeId: string,
  empresaCodigos: number[],
): Promise<ComplianceJustificativa[]> => {
  if (!supabase || empresaCodigos.length === 0) return []
  const { data, error } = await supabase
    .from('compliance_justificativas')
    .select('*')
    .eq('rede_id', redeId)
    .in('empresa_codigo', empresaCodigos)
    .order('criado_em', { ascending: false })
    .limit(2000)
  if (error) {
    console.warn('[complianceJustificativas] fetch error:', error.message)
    return []
  }
  return (data ?? []) as ComplianceJustificativa[]
}

/** Grava uma justificativa (append-only). Retorna a linha criada. */
export const addComplianceJustificativa = async (
  input: AddJustificativaInput,
  ctx: JustificativaContext,
): Promise<ComplianceJustificativa | null> => {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('compliance_justificativas')
    .insert({
      rede_id: ctx.redeId,
      empresa_codigo: input.empresaCodigo,
      produto_codigo: input.produtoCodigo,
      troca_data: input.trocaData.slice(0, 10),
      troca_preco_novo: input.trocaPrecoNovo,
      preco_antigo: input.precoAntigo,
      custo_referencia: input.custoReferencia,
      justificativa: input.justificativa,
      criado_por: ctx.userId,
      criado_por_nome: ctx.userNome,
    })
    .select()
    .single()
  if (error) {
    console.warn('[complianceJustificativas] insert error:', error.message)
    throw error
  }
  return data as ComplianceJustificativa
}
