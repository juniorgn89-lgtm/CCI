import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTenantStore } from '@/store/tenant'

/**
 * Quantas tarefas pedem atenção na rede: abertas e já vencidas, ou vencendo
 * hoje. Alimenta a bolinha do item "Tarefas" no menu. Consulta leve (só ids)
 * e só quando a rede tem o módulo ligado.
 */
export const useTarefasAtencao = (): number => {
  const rede = useTenantStore((s) => s.rede)
  const ativo = !!rede?.id && !!rede.gestao_habilitado && !!supabase
  const { data } = useQuery({
    queryKey: ['gestao-tarefas', 'atencao', rede?.id],
    enabled: ativo,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!supabase || !rede?.id) return 0
      const d = new Date()
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const { count, error } = await supabase
        .from('gestao_tarefas')
        .select('id', { count: 'exact', head: true })
        .eq('rede_id', rede.id)
        .in('status', ['a_fazer', 'em_andamento'])
        .lte('vence_dia', hoje)
      if (error) return 0
      return count ?? 0
    },
  })
  return ativo ? (data ?? 0) : 0
}
