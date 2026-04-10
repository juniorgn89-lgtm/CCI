import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
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
  const hasSynced = useRef(false)
  const configured = isSupabaseConfigured()

  // Sync snapshots when turnoRows change
  useEffect(() => {
    if (!configured || !empresaCodigo || turnoRows.length === 0 || hasSynced.current) return

    const snapshots: CaixaSnapshot[] = turnoRows.map((t) => ({
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
    hasSynced.current = true
  }, [configured, empresaCodigo, turnoRows])

  // Reset sync flag when empresa/period changes
  useEffect(() => {
    hasSynced.current = false
  }, [empresaCodigo, dataInicial, dataFinal])

  // Fetch alterations history
  const { data: alteracoes = [], isLoading } = useQuery<CaixaAlteracao[]>({
    queryKey: ['caixaAlteracoes', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchCaixaAlteracoes(empresaCodigo!, dataInicial, dataFinal),
    enabled: configured && !!empresaCodigo,
    staleTime: 5 * 60 * 1000,
  })

  return {
    alteracoes,
    isLoading,
    configured,
  }
}

export default useCaixaHistory
