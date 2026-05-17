import { supabase } from '@/lib/supabase'

export interface ProfileRow {
  user_id: string
  email: string
  full_name: string | null
  role: 'user' | 'supervisor'
  approved: boolean
  is_master: boolean
  rede_id: string | null
  /**
   * Lista de empresa_codigos permitidos pro usuário, dentro da rede dele.
   * null ou vazio = sem restrição (vê todas as empresas da rede).
   */
  empresa_codigos: number[] | null
  /**
   * Lista de ids de módulos liberados (dashboard, operacao, ...). Veja
   * src/lib/modulos.ts. null ou vazio = sem restrição (vê todos os módulos).
   */
  modulos_permitidos: string[] | null
  created_at: string
}

export const fetchProfiles = async (): Promise<ProfileRow[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

export const updateProfileRole = async (userId: string, role: 'user' | 'supervisor') => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('user_id', userId)
  if (error) throw error
}

export const updateProfileApproved = async (userId: string, approved: boolean) => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('profiles')
    .update({ approved })
    .eq('user_id', userId)
  if (error) throw error
}

export const updateProfileRedeId = async (userId: string, redeId: string) => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { error } = await supabase
    .from('profiles')
    .update({ rede_id: redeId })
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Define os postos permitidos pro usuário (filtro de visualização).
 * Passa array vazio ou null pra remover a restrição (vê todos da rede).
 */
export const updateProfileEmpresas = async (
  userId: string,
  empresaCodigos: number[] | null
) => {
  if (!supabase) throw new Error('Supabase não configurado')
  const value = empresaCodigos && empresaCodigos.length > 0 ? empresaCodigos : null
  const { error } = await supabase
    .from('profiles')
    .update({ empresa_codigos: value })
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Define os módulos liberados pro usuário (ids de src/lib/modulos.ts).
 * Passa array vazio ou null pra remover a restrição (vê todos os módulos).
 */
export const updateProfileModulos = async (
  userId: string,
  modulos: string[] | null
) => {
  if (!supabase) throw new Error('Supabase não configurado')
  const value = modulos && modulos.length > 0 ? modulos : null
  const { error } = await supabase
    .from('profiles')
    .update({ modulos_permitidos: value })
    .eq('user_id', userId)
  if (error) throw error
}

interface CreateUserInput {
  email: string
  password: string
  full_name: string
  role: 'user' | 'supervisor'
  rede_id: string
}

/**
 * Cria um usuário (gerente/supervisor) via Edge Function `create-user`. A função
 * roda com service_role no Supabase, valida que o caller é master e cria
 * auth.users + profile com approved=true (gerente confiou no cadastro).
 */
export const createUser = async (input: CreateUserInput): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const { data, error } = await supabase.functions.invoke('create-user', { body: input })
  if (error) throw new Error(error.message ?? 'Falha ao criar usuário')
  if (data?.error) throw new Error(data.error)
}

/**
 * Deleta um gerente/supervisor via Edge Function (service_role). Remove de
 * auth.users; cascade remove a row em profiles. Caller precisa ser master,
 * não pode deletar a si mesmo nem outros masters.
 */
export const deleteUser = async (userId: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { user_id: userId },
  })

  if (error) throw new Error(error.message ?? 'Falha ao deletar usuário')
  if (data?.error) throw new Error(data.error)
}
