import { supabase } from '@/lib/supabase'

/**
 * landing_leads — leads captados pelo chat da landing. Insert público (visitante
 * deslogado); leitura/edição só master. Ver docs/supabase-landing-leads.sql.
 */
export interface LandingLeadRow {
  id: string
  nome: string
  rede: string
  cidade: string
  sistema: string
  motivo: string
  whatsapp: string
  email: string
  origem: string
  atendido: boolean
  created_at: string
}

export type NovoLead = Pick<LandingLeadRow, 'nome' | 'rede' | 'cidade' | 'sistema' | 'motivo' | 'whatsapp' | 'email'>

/** Insere um lead (público). Lança em erro pra o chat sinalizar falha. */
export const insertLandingLead = async (lead: NovoLead): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.from('landing_leads').insert({ ...lead, origem: 'landing-chat' })
  if (error) throw error
}

/** Lista os leads (só master). */
export const fetchLandingLeads = async (): Promise<LandingLeadRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('landing_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []) as LandingLeadRow[]
}

/** Marca/desmarca um lead como atendido (só master). */
export const setLeadAtendido = async (id: string, atendido: boolean): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase.from('landing_leads').update({ atendido }).eq('id', id)
  if (error) throw error
}
