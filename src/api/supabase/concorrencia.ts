import { supabase } from '@/lib/supabase'

/**
 * Acesso ao log append-only de preço de praça (concorrencia_precos).
 * Leitura = GET; escrita = INSERT imperativo (padrão upsertApuracaoDiaria),
 * NUNCA useMutation. Editar um preço = inserir nova linha datada (o log é
 * imutável); o "preço atual" resolve por max(observado_em) → max(created_at).
 * Compliance CADE: só preço PÚBLICO observado. Ver docs/supabase-concorrencia.sql.
 */

export type FuelSlug =
  | 'gasolina_comum' | 'gasolina_aditivada'
  | 'diesel_s10' | 'diesel_s500' | 'etanol' | 'gnv'

export type FonteConcorrencia = 'observado' | 'app_publico' | 'anp'

export const FUEL_SLUGS: FuelSlug[] = [
  'gasolina_comum', 'gasolina_aditivada', 'diesel_s10', 'diesel_s500', 'etanol', 'gnv',
]

export const FUEL_LABEL: Record<FuelSlug, string> = {
  gasolina_comum: 'Gasolina',
  gasolina_aditivada: 'Aditivada',
  diesel_s10: 'Diesel S10',
  diesel_s500: 'Diesel S500',
  etanol: 'Etanol',
  gnv: 'GNV',
}

/** Classifica o nome do produto interno num slug de combustível. */
export const classifyFuelSlug = (nome: string): FuelSlug | null => {
  const n = (nome || '').toUpperCase()
  if (n.includes('GNV')) return 'gnv'
  if (n.includes('S-500') || n.includes('S500') || n.includes('S 500')) return 'diesel_s500'
  if (n.includes('S-10') || n.includes('S10') || n.includes('S 10')) return 'diesel_s10'
  if (n.includes('DIESEL')) return 'diesel_s500'
  if (n.includes('ETANOL') || n.includes('ALCOOL') || n.includes('ÁLCOOL')) return 'etanol'
  if (n.includes('ADITIVADA')) return 'gasolina_aditivada'
  if (n.includes('GASOLINA')) return 'gasolina_comum'
  return null
}

export interface ConcorrenciaPrecoRow {
  id: string
  rede_id: string
  empresa_codigo: number
  combustivel: FuelSlug
  concorrente_nome: string
  concorrente_postos: number
  preco: number
  observado_em: string // yyyy-MM-dd
  fonte: FonteConcorrencia
  observacao: string | null
  created_by: string
  /** Nome/email do autor, denormalizado no insert (quem lançou). */
  created_by_nome: string | null
  created_at: string
  /** Soft-delete: preenchido quando o concorrente é excluído (NULL = ativo). */
  deleted_at: string | null
  deleted_by: string | null
  deleted_by_nome: string | null
}

export type ConcorrenciaPrecoInsert = {
  rede_id: string
  empresa_codigo: number
  combustivel: FuelSlug
  concorrente_nome: string
  concorrente_postos: number
  preco: number
  fonte?: FonteConcorrencia
  observacao?: string | null
  /** Nome/email de quem está lançando (denormalizado p/ exibir sem ler profiles). */
  created_by_nome?: string | null
}

/** Lê as observações do posto a partir de `desde` (yyyy-MM-dd). RLS restringe à rede. */
export const fetchConcorrenciaPrecos = async (params: {
  empresaCodigo: number
  desde: string
}): Promise<ConcorrenciaPrecoRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('concorrencia_precos')
    .select('*')
    .eq('empresa_codigo', params.empresaCodigo)
    .is('deleted_at', null) // só concorrentes ativos
    .gte('observado_em', params.desde)
    .order('observado_em', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[concorrencia] fetch error:', error.message)
    return []
  }
  return (data ?? []) as ConcorrenciaPrecoRow[]
}

/** Lê as observações de TODA a rede a partir de `desde` (yyyy-MM-dd), sem filtro
 *  de empresa (RLS restringe à rede do usuário). Usado pela Oportunidades pra
 *  rodar a análise de praça por posto em todos os postos numa leitura só. */
export const fetchConcorrenciaPrecosRede = async (params: {
  desde: string
}): Promise<ConcorrenciaPrecoRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('concorrencia_precos')
    .select('*')
    .is('deleted_at', null) // só concorrentes ativos
    .gte('observado_em', params.desde)
    .order('observado_em', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[concorrencia] fetch rede error:', error.message)
    return []
  }
  return (data ?? []) as ConcorrenciaPrecoRow[]
}

/**
 * SOFT-DELETE de um concorrente num posto (marca deleted_at em todas as
 * observações ATIVAS dele). Preserva o histórico e registra quem/quando (o
 * trigger carimba deleted_at/deleted_by; `porNome` é o rótulo p/ exibir).
 * RLS: só master (policy de UPDATE). `.select()` conta as linhas afetadas:
 * 0 sem erro = RLS bloqueou (sem permissão).
 */
export const deleteConcorrente = async (params: {
  empresaCodigo: number
  concorrenteNome: string
  porNome?: string | null
}): Promise<{ ok: boolean; count?: number; error?: string }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  const { data, error } = await supabase
    .from('concorrencia_precos')
    .update({ deleted_at: new Date().toISOString(), deleted_by_nome: params.porNome ?? null })
    .eq('empresa_codigo', params.empresaCodigo)
    .eq('concorrente_nome', params.concorrenteNome)
    .is('deleted_at', null)
    .select('id')
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: data?.length ?? 0 }
}

/** Restaura um concorrente soft-deletado (deleted_at → NULL). Master-only. */
export const restoreConcorrente = async (params: {
  empresaCodigo: number
  concorrenteNome: string
}): Promise<{ ok: boolean; count?: number; error?: string }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  const { data, error } = await supabase
    .from('concorrencia_precos')
    .update({ deleted_at: null })
    .eq('empresa_codigo', params.empresaCodigo)
    .eq('concorrente_nome', params.concorrenteNome)
    .not('deleted_at', 'is', null)
    .select('id')
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: data?.length ?? 0 }
}

/** Lê os concorrentes EXCLUÍDOS (soft-deletados) de um posto — auditoria "quem excluiu". */
export const fetchConcorrenciaExcluidos = async (params: {
  empresaCodigo: number
}): Promise<ConcorrenciaPrecoRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('concorrencia_precos')
    .select('*')
    .eq('empresa_codigo', params.empresaCodigo)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) {
    console.warn('[concorrencia] fetch excluidos error:', error.message)
    return []
  }
  return (data ?? []) as ConcorrenciaPrecoRow[]
}

/** INSERT de uma observação (append-only). RLS exige permissão + escopo de empresa. */
export const insertConcorrenciaPrecos = async (
  rows: ConcorrenciaPrecoInsert[],
): Promise<{ ok: boolean; error?: string }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  if (rows.length === 0) return { ok: true }
  const { error } = await supabase.from('concorrencia_precos').insert(rows)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
