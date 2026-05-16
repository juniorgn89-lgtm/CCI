import { supabase } from '@/lib/supabase'

export interface ProfileRow {
  user_id: string
  email: string
  full_name: string | null
  role: 'user' | 'supervisor'
  approved: boolean
  is_master: boolean
  rede_id: string | null
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
