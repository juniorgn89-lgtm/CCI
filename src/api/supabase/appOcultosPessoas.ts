import { supabase } from '@/lib/supabase'

/**
 * Módulos e abas ocultos para UMA pessoa numa rede
 * (supabase/migrations/20261124000003_app_ocultos_pessoas.sql).
 * Só visual — a permissão de acesso continua no cadastro do usuário.
 */
export interface OcultoPessoa { rede_id: string; user_id: string; chave: string }

const need = () => { if (!supabase) throw new Error('Supabase não configurado'); return supabase }
const semTabela = (code?: string) => code === '42P01' || code === 'PGRST205'

/** Tudo o que está oculto por pessoa nesta rede (o RLS devolve só o que quem chama pode ver). */
export const fetchOcultosPessoas = async (redeId: string): Promise<OcultoPessoa[]> => {
  const { data, error } = await need().from('app_ocultos_pessoas').select('rede_id, user_id, chave').eq('rede_id', redeId)
  if (error) { if (semTabela(error.code)) return []; throw error }
  return (data ?? []) as OcultoPessoa[]
}

/** Troca o conjunto oculto de uma pessoa nesta rede pelo informado. */
export const salvarOcultosPessoa = async (redeId: string, userId: string, chaves: string[]): Promise<void> => {
  const sb = need()
  const del = await sb.from('app_ocultos_pessoas').delete().eq('rede_id', redeId).eq('user_id', userId)
  if (del.error) {
    if (semTabela(del.error.code)) throw new Error('A tabela ainda não foi criada no banco (rodar supabase/migrations/20261124000003_app_ocultos_pessoas.sql).')
    throw del.error
  }
  if (chaves.length === 0) return
  const { error } = await sb.from('app_ocultos_pessoas').insert(chaves.map((chave) => ({ rede_id: redeId, user_id: userId, chave })))
  if (error) throw error
}
