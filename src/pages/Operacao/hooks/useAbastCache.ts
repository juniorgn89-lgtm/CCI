import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { supabase } from '@/lib/supabase'
import {
  fetchAbastecimentosCache,
  cacheRowToAbastecimento,
  splitPeriodAtToday,
  enumerateDays,
  type PeriodSplit,
} from '@/api/supabase/apuracao'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import type { Abastecimento } from '@/api/types/combustivel'

interface UseAbastCacheInput {
  /** Period que se quer consultar (current period ou prev period). */
  dataInicial: string
  dataFinal: string
  /** Filtra rows pra essa empresa específica (null = todas da rede). */
  empresaCodigo: number | null
  /** Lista total de empresas permitidas pra essa rede (usado p/ HIT quando empresaCodigo=null). */
  empresasPermitidasCount: number
  /** Liga/desliga o cache inteiro (probes + fetch). Default true. `false` evita o
   * SELECT rede-wide pesado em apuracao_abastecimentos (que pode dar statement
   * timeout) quando não há um posto único selecionado. */
  enabled?: boolean
}

export interface UseAbastCacheResult {
  isEligible: boolean
  isChecking: boolean
  /** True quando todos os dias fechados do período estão apurados (apuracao_diaria coverage). */
  isCacheHit: boolean
  /** Abastecimentos do cache em shape Abastecimento (mapeados pra reuso a jusante). */
  abastecimentos: Abastecimento[]
  split: PeriodSplit
}

/**
 * Cache de abastecimentos raw em Supabase. Detecta HIT contando rows em
 * apuracao_diaria (que é gravada junto com abast_cache pelo /admin/apuracao).
 * Quando HIT, /operacao não precisa chamar a API Quality pra essa faixa.
 */
const useAbastCache = (input: UseAbastCacheInput): UseAbastCacheResult => {
  const rede = useTenantStore((s) => s.rede)
  const { dataInicial, dataFinal, empresaCodigo, empresasPermitidasCount, enabled = true } = input

  const split = useMemo(
    () => splitPeriodAtToday(dataInicial, dataFinal),
    [dataInicial, dataFinal]
  )

  const isEligible = enabled && !!rede && !!split.closedDays && empresasPermitidasCount > 0

  const closedIni = split.closedDays?.dataInicial ?? ''
  const closedEnd = split.closedDays?.dataFinal ?? ''
  const closedDaysCount = useMemo(
    () => (split.closedDays ? enumerateDays(split.closedDays.dataInicial, split.closedDays.dataFinal).length : 0),
    [split.closedDays]
  )
  const expectedScopeEmpresas = empresaCodigo != null ? 1 : empresasPermitidasCount
  const expectedCount = closedDaysCount * expectedScopeEmpresas

  // Probe 1: cobertura em apuracao_diaria (todos os dias × empresas).
  const { data: diariaCount = 0, isLoading: loadingDiariaProbe } = useQuery({
    queryKey: ['apuracao-diaria-probe', rede?.id, empresaCodigo ?? 'all', closedIni, closedEnd],
    queryFn: async () => {
      if (!supabase || !rede) return 0
      let query = supabase
        .from('apuracao_diaria')
        .select('*', { count: 'exact', head: true })
        .eq('rede_id', rede.id)
        .gte('data', closedIni)
        .lte('data', closedEnd)
      if (empresaCodigo != null) query = query.eq('empresa_codigo', empresaCodigo)
      const { count } = await query
      return count ?? 0
    },
    enabled: isEligible,
    staleTime: 5 * 60 * 1000,
  })

  // Probe 2: pelo menos 1 row em apuracao_abastecimentos. Sem isso, uma
  // apuração antiga (antes do deploy do cache raw) acionaria HIT falso
  // baseado só em apuracao_diaria — e o user veria abast = 0.
  const { data: abastProbeCount = 0, isLoading: loadingAbastProbe } = useQuery({
    queryKey: ['apuracao-abast-probe', rede?.id, empresaCodigo ?? 'all', closedIni, closedEnd],
    queryFn: async () => {
      if (!supabase || !rede) return 0
      let query = supabase
        .from('apuracao_abastecimentos')
        .select('*', { count: 'exact', head: true })
        .eq('rede_id', rede.id)
        .gte('data_fiscal', closedIni)
        .lte('data_fiscal', closedEnd)
      if (empresaCodigo != null) query = query.eq('empresa_codigo', empresaCodigo)
      const { count } = await query
      return count ?? 0
    },
    enabled: isEligible,
    staleTime: 5 * 60 * 1000,
  })

  const loadingProbe = loadingDiariaProbe || loadingAbastProbe
  // HIT precisa de cobertura completa em diaria E presença de raw em abast.
  // Se diaria está OK mas abast está vazia → apuração antiga ⇒ MISS pra
  // forçar refetch live (que repopula via /admin/apuracao quando o user
  // reapurar).
  const isCacheHit =
    isEligible &&
    !loadingProbe &&
    diariaCount >= expectedCount &&
    expectedCount > 0 &&
    abastProbeCount > 0

  // Só puxa abast cache quando confirmamos HIT — evita SELECT grande à toa.
  const empresaCodigosForQuery = empresaCodigo != null ? [empresaCodigo] : undefined
  const { data: rows = [], isLoading: loadingRows } = useQuery({
    queryKey: ['apuracao-abast', rede?.id, empresaCodigosForQuery?.join(',') ?? 'all', closedIni, closedEnd],
    queryFn: () =>
      fetchAbastecimentosCache({
        empresaCodigos: empresaCodigosForQuery,
        dataInicial: closedIni,
        dataFinal: closedEnd,
      }),
    enabled: isCacheHit,
    staleTime: 5 * 60 * 1000,
  })

  // HOJE — sempre live (volátil), só quando hoje está no período. Cache cobre
  // só dias fechados, então sem este fetch perderíamos as horas de hoje.
  const todayIni = split.todayPart?.dataInicial ?? ''
  const todayEnd = split.todayPart?.dataFinal ?? ''
  const { data: todayAbastRaw = [], isLoading: loadingToday } = useQuery({
    queryKey: ['abast-cache-today', todayIni, todayEnd],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: todayIni, dataFinal: todayEnd }),
    enabled: isCacheHit && !!split.todayPart,
    staleTime: 60 * 1000,
  })

  const abastecimentos = useMemo(() => {
    const fromCache = rows.map(cacheRowToAbastecimento)
    const fromToday = todayAbastRaw.filter(
      (a) => empresaCodigo == null || a.empresaCodigo === empresaCodigo,
    )
    return [...fromCache, ...fromToday]
  }, [rows, todayAbastRaw, empresaCodigo])

  return {
    isEligible,
    isChecking: isEligible && (loadingProbe || (isCacheHit && (loadingRows || loadingToday))),
    isCacheHit: isCacheHit && !loadingRows,
    abastecimentos,
    split,
  }
}

export default useAbastCache
