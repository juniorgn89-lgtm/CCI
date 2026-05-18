import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import {
  fetchApuracaoDiaria,
  splitPeriodAtToday,
  enumerateDays,
} from '@/api/supabase/apuracao'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchCaixas } from '@/api/endpoints/financeiro'

/**
 * Hook dedicado pra Dashboard > ResumoOperacao (visão single-posto).
 *
 * Diferente do useOperacaoData (que alimenta toda a tela /operacao com row-level
 * detail), esse hook só precisa de agregados — KPIs totais, faturamento/litros
 * por dia, e apurado por dia. Por isso usa o cache `apuracao_diaria` direto.
 *
 *  - dias fechados → cache Supabase (filtrado pela empresa selecionada)
 *  - hoje (se está no período) → live abast (1 dia, rápido)
 *  - apurado por dia / total apurado → /CAIXA (sempre live, é volátil)
 *
 * Quando o mês inteiro está apurado (via /admin/apuracao), o único fetch da
 * Quality nessa tela é o /CAIXA — instantâneo.
 */
export interface ResumoOperacaoData {
  faturamentoCombustivel: number
  totalLitros: number
  totalApurado: number
  litrosPorDia: { data: string; litros: number }[]
  apuradoPorDia: { data: string; apurado: number }[]
  isLoading: boolean
  /** True quando os dados de combustível vieram do cache Supabase. */
  isCacheHit: boolean
}

const useResumoOperacaoData = (): ResumoOperacaoData => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const rede = useTenantStore((s) => s.rede)

  const split = useMemo(
    () => splitPeriodAtToday(dataInicial, dataFinal),
    [dataInicial, dataFinal]
  )
  const closedIni = split.closedDays?.dataInicial ?? ''
  const closedEnd = split.closedDays?.dataFinal ?? ''

  // Cache read pros dias fechados — filtrado pela empresa selecionada
  const { data: cacheRows = [], isLoading: loadingCache } = useQuery({
    queryKey: ['apuracao-cache-resumo', rede?.id, empresaCodigo, closedIni, closedEnd],
    queryFn: () =>
      fetchApuracaoDiaria({
        empresaCodigos: empresaCodigo != null ? [empresaCodigo] : [],
        dataInicial: closedIni,
        dataFinal: closedEnd,
      }),
    enabled: !!rede && empresaCodigo != null && !!split.closedDays,
    staleTime: 5 * 60 * 1000,
  })

  const closedDaysCount = useMemo(
    () =>
      split.closedDays
        ? enumerateDays(split.closedDays.dataInicial, split.closedDays.dataFinal).length
        : 0,
    [split.closedDays]
  )
  // HIT: cache cobre todos os dias fechados pra essa empresa.
  // (1 row por dia × 1 empresa = closedDaysCount rows.)
  const isCacheHit =
    !!split.closedDays &&
    !loadingCache &&
    cacheRows.length >= closedDaysCount &&
    closedDaysCount > 0

  // Live abast pra HOJE (se está no período). Só 1 dia, rápido.
  const todayIni = split.todayPart?.dataInicial ?? ''
  const todayEnd = split.todayPart?.dataFinal ?? ''
  const { data: todayAbast = [], isLoading: loadingTodayAbast } = useQuery({
    queryKey: ['abast-resumo-today', todayIni, todayEnd],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: todayIni, dataFinal: todayEnd }),
    enabled: !!split.todayPart && empresaCodigo != null,
  })

  // Fallback: cache MISS → live abast do período inteiro
  const { data: liveAbast = [], isLoading: loadingLiveAbast } = useQuery({
    queryKey: ['abast-resumo', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: empresaCodigo != null && !isCacheHit && !loadingCache,
  })

  // Caixas — sempre live (totalApurado e apuradoPorDia são voláteis).
  // Fetch é leve pra 1 empresa.
  const { data: caixasData, isLoading: loadingCaixas } = useQuery({
    queryKey: ['caixas-resumo', empresaCodigo, dataInicial, dataFinal],
    queryFn: () =>
      fetchCaixas({
        empresaCodigo: empresaCodigo!,
        dataInicial,
        dataFinal,
        limite: 1000,
      }),
    enabled: empresaCodigo != null,
  })

  const computed = useMemo(() => {
    // Caixas → totalApurado + apuradoPorDia
    const caixas = caixasData?.resultados ?? []
    const totalApurado = caixas.reduce((s, c) => s + (c.apurado ?? 0), 0)
    const apuradoByDay = new Map<string, number>()
    for (const c of caixas) {
      const day = c.dataMovimento?.slice(0, 10) ?? ''
      if (!day) continue
      apuradoByDay.set(day, (apuradoByDay.get(day) ?? 0) + (c.apurado ?? 0))
    }
    const apuradoPorDia = Array.from(apuradoByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, apurado]) => ({ data, apurado }))

    // Fuel: agrega de cache (closed days) + live hoje OU de live full (MISS)
    let totalLitros = 0
    let faturamentoCombustivel = 0
    const litrosByDay = new Map<string, number>()

    if (isCacheHit) {
      for (const r of cacheRows) {
        totalLitros += r.fuel_litros
        faturamentoCombustivel += r.fuel_faturamento
        litrosByDay.set(r.data, (litrosByDay.get(r.data) ?? 0) + r.fuel_litros)
      }
      // Hoje (se aplicável)
      for (const a of todayAbast) {
        if (empresaCodigo != null && a.empresaCodigo !== empresaCodigo) continue
        const day = (a.dataFiscal || a.dataHoraAbastecimento?.slice(0, 10) || '').slice(0, 10)
        if (!day) continue
        totalLitros += a.quantidade
        faturamentoCombustivel += a.valorTotal
        litrosByDay.set(day, (litrosByDay.get(day) ?? 0) + a.quantidade)
      }
    } else {
      // Cache MISS — usa live abast do período inteiro
      for (const a of liveAbast) {
        if (empresaCodigo != null && a.empresaCodigo !== empresaCodigo) continue
        const day = (a.dataFiscal || a.dataHoraAbastecimento?.slice(0, 10) || '').slice(0, 10)
        if (!day) continue
        totalLitros += a.quantidade
        faturamentoCombustivel += a.valorTotal
        litrosByDay.set(day, (litrosByDay.get(day) ?? 0) + a.quantidade)
      }
    }

    const litrosPorDia = Array.from(litrosByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, litros]) => ({ data, litros }))

    return { faturamentoCombustivel, totalLitros, totalApurado, litrosPorDia, apuradoPorDia }
  }, [isCacheHit, cacheRows, todayAbast, liveAbast, caixasData, empresaCodigo])

  // Loading: aguardando cache lookup, ou aguardando live fetches relevantes.
  const isLoading =
    loadingCaixas ||
    (!!split.closedDays && loadingCache && cacheRows.length === 0) ||
    (!isCacheHit && empresaCodigo != null && loadingLiveAbast) ||
    (!!split.todayPart && loadingTodayAbast)

  return { ...computed, isLoading, isCacheHit }
}

export default useResumoOperacaoData
