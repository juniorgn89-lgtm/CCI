import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import {
  syncCaixaSnapshots,
  fetchCaixaAlteracoes,
  type CaixaSnapshot,
  type CaixaAlteracao,
  type ActorInfo,
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
  const authUser = useAuthStore((s) => s.user)
  const configured = isSupabaseConfigured()

  // Nome do user logado pra rastreio (column detectado_por_nome no DB).
  // Busca uma vez por sessão a partir do profile — fallback pro email se
  // o profile não tem full_name.
  const [actorNome, setActorNome] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const fetchActor = async () => {
      if (!authUser || !supabase) {
        setActorNome(null)
        return
      }
      // 1) Metadata do auth user (mais rápido, geralmente vem do signup)
      const metaName = authUser.user_metadata?.full_name as string | undefined
      if (metaName) {
        if (!cancelled) setActorNome(metaName)
        return
      }
      // 2) Fallback: nome do profile (caso metadata esteja vazio)
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (cancelled) return
      setActorNome((data?.full_name as string) || authUser.email || null)
    }
    fetchActor()
    return () => { cancelled = true }
  }, [authUser])

  // Sincroniza snapshots toda vez que turnoRows mudar (refetch do React Query,
  // mudança de empresa/período, etc.). O batch interno do syncCaixaSnapshots
  // evita explosão de round-trips.
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

    const actor: ActorInfo = {
      userId: authUser?.id ?? null,
      nome: actorNome,
    }

    syncCaixaSnapshots(snapshots, actor).catch(console.error)
  }, [configured, redeId, empresaCodigo, turnoRows, authUser, actorNome])

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
