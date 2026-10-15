import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'

/**
 * Quantas tarefas pedem atenção na rede: abertas e já vencidas, ou vencendo
 * hoje. Alimenta a bolinha do item "Tarefas" no menu. Consulta leve (só ids)
 * e só quando a rede tem o módulo ligado.
 */
export const useTarefasAtencao = (): number => {
  const rede = useTenantStore((s) => s.rede)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const isMaster = useAuthStore((s) => s.isMaster)
  const canGerir = useAuthStore((s) => s.canGerirTarefas)
  // Gestor vê a rede inteira; quem só executa vê só o que é dele.
  const soMinhas = !(isMaster || canGerir)
  const ativo = !!rede?.id && !!rede.gestao_habilitado && !!supabase && (!soMinhas || !!userId)
  const { data } = useQuery({
    queryKey: ['gestao-tarefas', 'atencao', rede?.id, soMinhas ? userId : 'rede'],
    enabled: ativo,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!supabase || !rede?.id) return 0
      const d = new Date()
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      let q = supabase
        .from('gestao_tarefas')
        .select('id', { count: 'exact', head: true })
        .eq('rede_id', rede.id)
        .in('status', ['a_fazer', 'em_andamento'])
        .lte('vence_dia', hoje)
      if (soMinhas && userId) q = q.eq('responsavel_id', userId)
      const { count, error } = await q
      if (error) return 0
      return count ?? 0
    },
  })
  return ativo ? (data ?? 0) : 0
}
