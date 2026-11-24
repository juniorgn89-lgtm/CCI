import { supabase } from '@/lib/supabase'

/**
 * Módulos e abas ocultos pela CCI (supabase/migrations/20261124000002_app_ocultos.sql).
 * chave = rota do módulo ('/financeiro') ou 'módulo::aba' ('/financeiro::cartoes');
 * redes = null → todas as redes; senão só as listadas.
 */
export interface AppOculto {
  chave: string
  redes: string[] | null
  atualizado_em: string
}

const need = () => { if (!supabase) throw new Error('Supabase não configurado'); return supabase }
const semTabela = (code?: string) => code === '42P01' || code === 'PGRST205'

/** Tabela ausente (SQL não rodado) = nada oculto, sem quebrar o app. */
export const fetchAppOcultos = async (): Promise<AppOculto[]> => {
  const { data, error } = await need().from('app_ocultos').select('chave, redes, atualizado_em')
  if (error) { if (semTabela(error.code)) return []; throw error }
  return (data ?? []) as AppOculto[]
}

/** Oculta (ou muda onde fica oculto). redes = null → todas as redes. */
export const salvarAppOculto = async (chave: string, redes: string[] | null): Promise<void> => {
  const sb = need()
  const { data: u } = await sb.auth.getUser()
  const { error } = await sb.from('app_ocultos').upsert(
    { chave, redes: redes && redes.length ? redes : null, atualizado_em: new Date().toISOString(), atualizado_por: u.user?.id ?? null },
    { onConflict: 'chave' },
  )
  if (error) {
    if (semTabela(error.code)) throw new Error('A tabela de ocultos ainda não foi criada no banco (rodar supabase/migrations/20261124000002_app_ocultos.sql).')
    throw error
  }
}

/** Mostra de novo em todas as redes. */
export const removerAppOculto = async (chave: string): Promise<void> => {
  const { error } = await need().from('app_ocultos').delete().eq('chave', chave)
  if (error) throw error
}
