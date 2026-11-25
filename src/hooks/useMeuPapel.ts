import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { fetchMeuPapel } from '@/api/supabase/gestaoTarefas'

/** Papel do usuário logado em profiles.role ('user' | 'supervisor'). Diretor = isMaster. */
const useMeuPapel = () => {
  const userId = useAuthStore((s) => s.user?.id)
  const isMaster = useAuthStore((s) => s.isMaster)
  const q = useQuery({ queryKey: ['gestao-meu-papel', userId], queryFn: fetchMeuPapel, enabled: !!userId && !isMaster, staleTime: 10 * 60 * 1000 })
  return { papel: q.data ?? null, carregando: q.isLoading && !isMaster, supervisor: !isMaster && q.data === 'supervisor' }
}

export default useMeuPapel
