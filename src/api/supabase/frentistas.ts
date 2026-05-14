import { supabase } from '@/lib/supabase'

export interface FrentistaRow {
  user_id: string
  codigo: number
  nome: string
  empresa_codigo: number
  empresa_nome: string
  funcionario_codigo: number | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export const fetchFrentistas = async (): Promise<FrentistaRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('frentistas')
    .select('*')
    .order('codigo', { ascending: true })
  if (error) throw error
  return (data ?? []) as FrentistaRow[]
}

export const toggleFrentistaAtivo = async (userId: string, ativo: boolean) => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('frentistas')
    .update({ ativo })
    .eq('user_id', userId)
  if (error) throw error

  // Atualiza também o user_metadata pra manter consistência (login lê de ambos)
  // Note: requer service_role pra atualizar metadata de outros users; isso seria
  // feito numa Edge Function. Por ora, o login flow será atualizado pra usar a
  // tabela como source-of-truth, então user_metadata pode ficar desincronizado
  // sem afetar comportamento.
}

interface CreateFrentistaInput {
  codigo: number
  pin: string
  nome: string
  empresa_codigo: number
  empresa_nome: string
  funcionario_codigo?: number
}

/**
 * Cria um frentista chamando a Edge Function `create-frentista`. A função roda
 * com service_role no Supabase, valida que o caller é supervisor e cria
 * auth.users + frentistas em uma operação atômica (rollback em caso de falha).
 */
export const createFrentista = async (input: CreateFrentistaInput): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const { data, error } = await supabase.functions.invoke('create-frentista', {
    body: input,
  })

  if (error) throw new Error(error.message ?? 'Falha ao criar frentista')
  if (data?.error) throw new Error(data.error)
}
