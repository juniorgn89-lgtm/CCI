import { supabase } from '@/lib/supabase'

export interface ProfileRow {
  user_id: string
  email: string
  full_name: string | null
  role: 'user' | 'supervisor'
  approved: boolean
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
