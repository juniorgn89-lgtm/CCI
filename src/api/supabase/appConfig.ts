import { supabase } from '@/lib/supabase'

/**
 * app_config — config GLOBAL do app (singleton id='global'). Ver
 * docs/supabase-app-config.sql. Leitura pública; escrita só master.
 */
export interface AppConfigRow {
  id: string
  stripe_link_base: string
  stripe_link_ia: string
  stripe_pk: string
  webposto_telefone: string
  webposto_whatsapp: string
  webposto_mensagem: string
  comercial_whatsapp: string
  assinatura_manutencao: boolean
  assinatura_manutencao_msg: string
  /* ─── Contrato WebPosto (docs/supabase-app-config-contrato.sql) ─── */
  /** Valor líquido por posto ativo ao mês (R$). */
  contrato_valor_posto?: number | string | null
  /** Alíquota efetiva do Simples em %, para o gross-up. */
  contrato_aliquota_pct?: number | string | null
  contrato_inicio?: string | null
  contrato_observacoes?: string | null
  /* ─── Modelo de indicação (docs/supabase-contrato-modelo-indicacao.sql) ─── */
  /** % do valor recebido por posto indicado que a CCI repassa ao WebPosto. */
  contrato_pct_repasse?: number | string | null
  /** % após 12 meses de cada cliente (Opção A). null = percentual único. */
  contrato_pct_apos_12m?: number | string | null
  updated_at: string
}

export type AppConfigPatch = Partial<Omit<AppConfigRow, 'id' | 'updated_at'>>

/** Lê a linha única de config. `null` se supabase não configurado ou linha ausente. */
export const fetchAppConfig = async (): Promise<AppConfigRow | null> => {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_config')
    .select('*')
    .eq('id', 'global')
    .maybeSingle()
  if (error) throw error
  return (data as AppConfigRow | null) ?? null
}

/** Grava a config (upsert da linha 'global'). Só master passa na RLS. */
export const updateAppConfig = async (patch: AppConfigPatch): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('app_config')
    .upsert({ id: 'global', ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  // Surface the real Postgres/PostgREST error (missing table/column, RLS, etc.)
  // — o objeto de erro do supabase não é um Error, então repassamos a mensagem.
  if (error) throw new Error([error.message, error.details, error.hint].filter(Boolean).join(' · '))
}
