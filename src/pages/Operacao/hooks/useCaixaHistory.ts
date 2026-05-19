import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import {
  syncCaixaSnapshots,
  fetchCaixaAlteracoes,
  type CaixaSnapshot,
  type CaixaAlteracao,
} from '@/api/supabase/caixaHistory'
import type { TurnoRow } from './useOperacaoData'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return !!url && !!key && url !== '' && key !== ''
}

interface UseCaixaHistoryParams {
  turnoRows: TurnoRow[]
}

const useCaixaHistory = ({ turnoRows }: UseCaixaHistoryParams) => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const configured = isSupabaseConfigured()

  // Sincroniza snapshots toda vez que turnoRows mudar (refetch do React Query,
  // mudança de empresa/período, etc.). Sem flag de "synced uma vez" — assim
  // o histórico capta alterações que aconteceram entre refreshes na sessão.
  // O batch interno do syncCaixaSnapshots evita explosão de round-trips.
  useEffect(() => {
    if (!configured || !redeId || !empresaCodigo || turnoRows.length === 0) return

    const snapshots: CaixaSnapshot[] = turnoRows.map((t) => ({
      rede_id: redeId,
      empresa_codigo: empresaCodigo,
      caixa_codigo: t.caixaCodigo,
      turno_codigo: t.turnoCodigo,
      funcionario_codigo: t.funcionarioCodigo,
      funcionario_nome: t.funcionarioNome,
      data_movimento: t.dataMovimento,
      apurado: t.apurado,
      diferenca: t.diferenca,
      fechado: t.fechado,
    }))

    syncCaixaSnapshots(snapshots).catch(console.error)
  }, [configured, redeId, empresaCodigo, turnoRows])

  const { data: alteracoes = [], isLoading } = useQuery<CaixaAlteracao[]>({
    queryKey: ['caixaAlteracoes', redeId, empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchCaixaAlteracoes(redeId!, empresaCodigo!, dataInicial, dataFinal),
    enabled: configured && !!redeId && !!empresaCodigo,
    staleTime: 5 * 60 * 1000,
  })

  return {
    alteracoes,
    isLoading,
    configured,
  }
}

export default useCaixaHistory
