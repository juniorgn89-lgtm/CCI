import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { fetchCciServicos } from '@/api/supabase/cciServicos'
import { todayLocal } from '@/lib/period'

/**
 * Serviços da CCI que a rede contratou, por posto (cópia diária do Prospecção).
 * `ativosPorPosto`: empresa_codigo → serviços ativos hoje (sem data de fim ou fim no futuro).
 */
const useCciServicos = () => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const q = useQuery({
    queryKey: ['cci-servicos', redeId],
    queryFn: () => fetchCciServicos(redeId!),
    enabled: !!redeId,
    staleTime: 30 * 60 * 1000,
  })
  const hoje = todayLocal()
  const ativosPorPosto = useMemo(() => {
    const m = new Map<number, Set<string>>()
    for (const s of q.data ?? []) {
      if (s.ate && s.ate < hoje) continue
      const set = m.get(s.empresa_codigo) ?? new Set<string>()
      set.add(s.servico)
      m.set(s.empresa_codigo, set)
    }
    return m
  }, [q.data, hoje])
  const sincronizadoEm = useMemo(() => (q.data ?? []).map((s) => s.sincronizado_em).sort().pop() ?? null, [q.data])
  return { servicos: q.data ?? [], ativosPorPosto, sincronizadoEm, carregando: q.isLoading }
}

export default useCciServicos
