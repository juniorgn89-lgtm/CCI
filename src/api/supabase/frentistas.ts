import { supabase } from '@/lib/supabase'

export interface FrentistaRow {
  user_id: string
  rede_id: string
  codigo: number
  nome: string
  empresa_codigo: number
  empresa_nome: string
  funcionario_codigo: number | null
  ativo: boolean
  created_at: string
  updated_at: string
}

/**
 * Lista frentistas. Quando `redeId` é informado, filtra por essa rede — usado
 * pelo master (controle total), que escolhe a rede no topo. Pra supervisor o
 * RLS já restringe à própria rede, mas passar o redeId mantém o escopo explícito.
 */
export const fetchFrentistas = async (redeId?: string): Promise<FrentistaRow[]> => {
  if (!supabase) return []
  let query = supabase.from('frentistas').select('*').order('codigo', { ascending: true })
  if (redeId) query = query.eq('rede_id', redeId)
  const { data, error } = await query
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

/**
 * Deleta um frentista via Edge Function (service_role). Remove o user de
 * auth.users; a FK ON DELETE CASCADE remove a row em frentistas. Caller precisa
 * ser supervisor da mesma rede ou master.
 */
export const deleteFrentista = async (userId: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const { data, error } = await supabase.functions.invoke('delete-frentista', {
    body: { user_id: userId },
  })

  if (error) throw new Error(error.message ?? 'Falha ao deletar frentista')
  if (data?.error) throw new Error(data.error)
}

/**
 * Gera o PIN padrão de reset: 3 primeiras letras minúsculas do nome,
 * sem acentos e sem espaços. Ex: "IVANILDO DA SILVA" → "iva".
 * Nomes com menos de 3 letras retornam o que tiver.
 */
export const pinFromNome = (nome: string): string => {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove combining diacritical marks
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()
    .substring(0, 3)
}

/**
 * Reseta o PIN do frentista via Edge Function `reset-frentista-pin`
 * (service_role). Caller precisa ser supervisor da mesma rede ou master.
 * O novo PIN é sempre as 3 primeiras letras do nome — frentista é
 * orientado a trocar pelo PIN definitivo no primeiro login após reset.
 */
export const resetFrentistaPin = async (userId: string, newPin: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const { data, error } = await supabase.functions.invoke('reset-frentista-pin', {
    body: { user_id: userId, new_pin: newPin },
  })

  if (error) throw new Error(error.message ?? 'Falha ao resetar PIN')
  if (data?.error) throw new Error(data.error)
}
