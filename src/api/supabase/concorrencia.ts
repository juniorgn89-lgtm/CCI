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
  created_at: string
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
 * Apaga TODAS as observações de um concorrente num posto (limpeza/correção —
 * ex.: cadastro de teste). RLS: só master (policy "concorrencia delete master").
 * Usa `.select()` pra contar as linhas removidas: 0 sem erro = RLS bloqueou
 * (sem permissão), já que um DELETE filtrado por RLS não acusa erro.
 */
export const deleteConcorrente = async (params: {
  empresaCodigo: number
  concorrenteNome: string
}): Promise<{ ok: boolean; count?: number; error?: string }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  const { data, error } = await supabase
    .from('concorrencia_precos')
    .delete()
    .eq('empresa_codigo', params.empresaCodigo)
    .eq('concorrente_nome', params.concorrenteNome)
    .select('id')
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: data?.length ?? 0 }
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
