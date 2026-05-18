import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { supabase } from '@/lib/supabase'
import {
  fetchCaixasCache,
  fetchFormasPagamentoCache,
  cacheRowToCaixa,
  cacheRowToFormaPagamento,
  splitPeriodAtToday,
} from '@/api/supabase/apuracao'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchVendaFormasPagamento } from '@/api/endpoints/vendas'
import type { Caixa } from '@/api/types/financeiro'
import type { VendaFormaPagamento } from '@/api/types/venda'

interface UseCaixasCacheInput {
  dataInicial: string
  dataFinal: string
  empresaCodigo: number | null
}

export interface UseCaixasCacheResult {
  isCacheHit: boolean
  isChecking: boolean
  caixas: Caixa[]
  formasPagamento: VendaFormaPagamento[]
}

/**
 * Cache combinado de caixas + formas de pagamento. HIT detectado por probe
 * em apuracao_caixas (que é populado junto com apuracao_formas_pagamento
 * pelo apurarMes em /admin/apuracao).
 *
 * Quando HIT, /operacao não precisa chamar /CAIXA nem /VENDA_FORMA_PAGAMENTO.
 */
const useCaixasCache = (input: UseCaixasCacheInput): UseCaixasCacheResult => {
  const rede = useTenantStore((s) => s.rede)
  const { dataInicial, dataFinal, empresaCodigo } = input

  const split = useMemo(
    () => splitPeriodAtToday(dataInicial, dataFinal),
    [dataInicial, dataFinal]
  )

  const isEligible = !!rede && !!dataInicial && !!dataFinal && empresaCodigo != null

  const closedIni = split.closedDays?.dataInicial ?? dataInicial
  const closedEnd = split.closedDays?.dataFinal ?? dataFinal

  // Probe: pelo menos 1 row em apuracao_caixas nos dias fechados.
  const { data: probeCount = 0, isLoading: loadingProbe } = useQuery({
    queryKey: ['apuracao-caixas-probe', rede?.id, empresaCodigo, closedIni, closedEnd],
    queryFn: async () => {
      if (!supabase || !rede || !split.closedDays) return 0
      let query = supabase
        .from('apuracao_caixas')
        .select('*', { count: 'exact', head: true })
        .eq('rede_id', rede.id)
        .gte('data_movimento', closedIni)
        .lte('data_movimento', closedEnd)
      if (empresaCodigo != null) query = query.eq('empresa_codigo', empresaCodigo)
      const { count } = await query
      return count ?? 0
    },
    enabled: isEligible && !!split.closedDays,
    staleTime: 5 * 60 * 1000,
  })

  const isCacheHit = isEligible && !!split.closedDays && !loadingProbe && probeCount > 0

  // Quando HIT, puxa caixas + formasPgto dos dias fechados.
  const empresaCodigos = empresaCodigo != null ? [empresaCodigo] : undefined

  const { data: caixasRows = [], isLoading: loadingCaixas } = useQuery({
    queryKey: ['apuracao-caixas', rede?.id, empresaCodigo, closedIni, closedEnd],
    queryFn: () => fetchCaixasCache({ empresaCodigos, dataInicial: closedIni, dataFinal: closedEnd }),
    enabled: isCacheHit,
    staleTime: 5 * 60 * 1000,
  })

  const { data: formasRows = [], isLoading: loadingFormas } = useQuery({
    queryKey: ['apuracao-formas', rede?.id, empresaCodigo, closedIni, closedEnd],
    queryFn: () => fetchFormasPagamentoCache({ empresaCodigos, dataInicial: closedIni, dataFinal: closedEnd }),
    enabled: isCacheHit,
    staleTime: 5 * 60 * 1000,
  })

  // HOJE — sempre live (volátil). Caixas abertos ao vivo, formas de pgto de
  // vendas do dia. Cache só cobre dias fechados; sem isso, "Ao vivo" mostra 0.
  const todayIni = split.todayPart?.dataInicial ?? ''
  const todayEnd = split.todayPart?.dataFinal ?? ''
  const todayEnabled = isCacheHit && !!split.todayPart && empresaCodigo != null

  const { data: todayCaixasRaw, isLoading: loadingTodayCaixas } = useQuery({
    queryKey: ['caixas-today', empresaCodigo, todayIni, todayEnd],
    queryFn: () => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial: todayIni, dataFinal: todayEnd, limite: 200 }),
    enabled: todayEnabled,
    staleTime: 60 * 1000,
  })

  const { data: todayFormasRaw, isLoading: loadingTodayFormas } = useQuery({
    queryKey: ['formas-today', empresaCodigo, todayIni, todayEnd],
    queryFn: () => fetchVendaFormasPagamento({ empresaCodigo: empresaCodigo!, dataInicial: todayIni, dataFinal: todayEnd, limite: 1000 }),
    enabled: todayEnabled,
    staleTime: 60 * 1000,
  })

  const caixas = useMemo(
    () => [
      ...caixasRows.map(cacheRowToCaixa),
      ...(todayCaixasRaw?.resultados ?? []),
    ],
    [caixasRows, todayCaixasRaw]
  )
  const formasPagamento = useMemo(
    () => [
      ...formasRows.map(cacheRowToFormaPagamento),
      ...(todayFormasRaw?.resultados ?? []),
    ],
    [formasRows, todayFormasRaw]
  )

  return {
    isCacheHit: isCacheHit && !loadingCaixas && !loadingFormas,
    isChecking:
      isEligible &&
      (loadingProbe ||
        (isCacheHit && (loadingCaixas || loadingFormas || loadingTodayCaixas || loadingTodayFormas))),
    caixas,
    formasPagamento,
  }
}

export default useCaixasCache
