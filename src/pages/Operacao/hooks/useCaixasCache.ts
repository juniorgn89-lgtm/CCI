import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { supabase } from '@/lib/supabase'
import {
  fetchCaixasCache,
  fetchFormasPagamentoCache,
  cacheRowToCaixa,
  cacheRowToFormaPagamento,
} from '@/api/supabase/apuracao'
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

  const isEligible = !!rede && !!dataInicial && !!dataFinal && empresaCodigo != null

  // Probe: pelo menos 1 row em apuracao_caixas pra esse período + empresa.
  const { data: probeCount = 0, isLoading: loadingProbe } = useQuery({
    queryKey: ['apuracao-caixas-probe', rede?.id, empresaCodigo, dataInicial, dataFinal],
    queryFn: async () => {
      if (!supabase || !rede) return 0
      let query = supabase
        .from('apuracao_caixas')
        .select('*', { count: 'exact', head: true })
        .eq('rede_id', rede.id)
        .gte('data_movimento', dataInicial)
        .lte('data_movimento', dataFinal)
      if (empresaCodigo != null) query = query.eq('empresa_codigo', empresaCodigo)
      const { count } = await query
      return count ?? 0
    },
    enabled: isEligible,
    staleTime: 5 * 60 * 1000,
  })

  const isCacheHit = isEligible && !loadingProbe && probeCount > 0

  // Quando HIT, puxa caixas + formasPgto em paralelo
  const empresaCodigos = empresaCodigo != null ? [empresaCodigo] : undefined

  const { data: caixasRows = [], isLoading: loadingCaixas } = useQuery({
    queryKey: ['apuracao-caixas', rede?.id, empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchCaixasCache({ empresaCodigos, dataInicial, dataFinal }),
    enabled: isCacheHit,
    staleTime: 5 * 60 * 1000,
  })

  const { data: formasRows = [], isLoading: loadingFormas } = useQuery({
    queryKey: ['apuracao-formas', rede?.id, empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchFormasPagamentoCache({ empresaCodigos, dataInicial, dataFinal }),
    enabled: isCacheHit,
    staleTime: 5 * 60 * 1000,
  })

  const caixas = useMemo(() => caixasRows.map(cacheRowToCaixa), [caixasRows])
  const formasPagamento = useMemo(
    () => formasRows.map(cacheRowToFormaPagamento),
    [formasRows]
  )

  return {
    isCacheHit: isCacheHit && !loadingCaixas && !loadingFormas,
    isChecking: isEligible && (loadingProbe || (isCacheHit && (loadingCaixas || loadingFormas))),
    caixas,
    formasPagamento,
  }
}

export default useCaixasCache
