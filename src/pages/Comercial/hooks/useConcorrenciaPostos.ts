import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { fetchConcorrenciaPostoConfig, setConcorrenciaPostoUsar } from '@/api/supabase/concorrencia'

/**
 * Uso dos vizinhos como referência, POR POSTO. Estado compartilhado pela rede
 * (Supabase), não mais um flag global no navegador. Sem linha = desligado.
 */
const useConcorrenciaPostos = () => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const meuNome = useAuthStore((s) => s.user?.email ?? null)
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['concorrencia-posto-config', redeId],
    queryFn: () => fetchConcorrenciaPostoConfig(redeId!),
    enabled: !!redeId,
    staleTime: 60 * 1000,
  })
  const [salvando, setSalvando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const porPosto = useMemo(() => {
    const m = new Map<number, { usar: boolean; porNome: string | null; em: string }>()
    for (const r of rows) m.set(r.empresa_codigo, { usar: r.usar, porNome: r.updated_by_nome, em: r.updated_at })
    return m
  }, [rows])

  const usa = (empresaCodigo: number) => porPosto.get(empresaCodigo)?.usar ?? false

  const alternar = async (empresaCodigo: number) => {
    if (!redeId) return
    setSalvando(empresaCodigo); setErro(null)
    const res = await setConcorrenciaPostoUsar({ redeId, empresaCodigo, usar: !usa(empresaCodigo), porNome: meuNome })
    setSalvando(null)
    if (!res.ok) {
      setErro(res.error?.includes('row-level security') ? 'Sem permissão para mudar (peça ao admin a permissão de concorrência).' : (res.error ?? 'Erro ao salvar.'))
      return
    }
    await qc.invalidateQueries({ queryKey: ['concorrencia-posto-config', redeId] })
  }

  return { isLoading, porPosto, usa, alternar, salvando, erro }
}

export default useConcorrenciaPostos
