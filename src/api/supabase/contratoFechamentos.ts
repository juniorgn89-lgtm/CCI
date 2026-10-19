import { supabase } from '@/lib/supabase'

/** Foto mensal do repasse WebPosto (docs/supabase-contrato-fechamentos.sql). Só master. */
export interface FechamentoRow {
  id: string
  competencia: string
  redes: number
  postos: number
  valor_posto: number | string
  aliquota_pct: number | string
  liquido: number | string
  faturado: number | string
  /* Modelo de indicação (docs/supabase-contrato-modelo-indicacao.sql) */
  pct_repasse?: number | string | null
  repasse?: number | string | null
  fica_cci?: number | string | null
  detalhes: { rede: string; postos: number; liquido: number }[]
  observacao: string | null
  criado_em: string
}

export const fetchFechamentos = async (): Promise<FechamentoRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase.from('contrato_webposto_fechamentos').select('*').order('competencia', { ascending: false }).limit(24)
  if (error) throw new Error(error.message)
  return (data as FechamentoRow[]) ?? []
}

export const salvarFechamento = async (f: Omit<FechamentoRow, 'id' | 'criado_em'>): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.from('contrato_webposto_fechamentos').upsert(f, { onConflict: 'competencia' })
  if (error) throw new Error([error.message, error.details, error.hint].filter(Boolean).join(' · '))
}
