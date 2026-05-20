import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { supabase } from '@/lib/supabase'
import {
  fetchVendasCache,
  splitPeriodAtToday,
  enumerateDays,
  type ApuracaoVendaRow,
  type PeriodSplit,
} from '@/api/supabase/apuracao'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { VendaItem } from '@/api/types/venda'

/**
 * Agregado de venda da loja por (empresa, dia, produto). É a unidade comum
 * entre cache (apuracao_vendas) e live — `linhas` preserva o nº de itens de
 * venda pra que o ticket médio (faturamento ÷ nº de itens) bata com o live.
 */
export interface VendaAgg {
  empresaCodigo: number
  data: string // yyyy-MM-dd
  produtoCodigo: number
  quantidade: number
  totalVenda: number
  totalCusto: number
  linhas: number
}

/** Agrega itens crus de venda em VendaAgg[] (mesma chave do cache). */
export const aggregateItensToVendaAgg = (itens: VendaItem[]): VendaAgg[] => {
  const map = new Map<string, VendaAgg>()
  for (const it of itens) {
    const data = it.dataMovimento ? it.dataMovimento.slice(0, 10) : ''
    if (!data) continue
    const key = `${it.empresaCodigo}|${data}|${it.produtoCodigo}`
    const e = map.get(key)
    if (e) {
      e.quantidade += it.quantidade ?? 0
      e.totalVenda += it.totalVenda ?? 0
      e.totalCusto += it.totalCusto ?? 0
      e.linhas += 1
    } else {
      map.set(key, {
        empresaCodigo: it.empresaCodigo,
        data,
        produtoCodigo: it.produtoCodigo,
        quantidade: it.quantidade ?? 0,
        totalVenda: it.totalVenda ?? 0,
        totalCusto: it.totalCusto ?? 0,
        linhas: 1,
      })
    }
  }
  return Array.from(map.values())
}

const cacheRowToVendaAgg = (r: ApuracaoVendaRow): VendaAgg => ({
  empresaCodigo: r.empresa_codigo,
  data: r.data,
  produtoCodigo: r.produto_codigo,
  quantidade: r.quantidade,
  totalVenda: r.total_venda,
  totalCusto: r.total_custo,
  linhas: r.linhas,
})

interface UseVendasCacheInput {
  /** Period que se quer consultar (current, prev month ou evolução). */
  dataInicial: string
  dataFinal: string
  /** Filtra rows pra essa empresa (null = todas da rede). */
  empresaCodigo: number | null
  /** Nº de empresas permitidas na rede (usado p/ HIT quando empresaCodigo=null). */
  empresasPermitidasCount: number
}

export interface UseVendasCacheResult {
  isEligible: boolean
  isChecking: boolean
  /** True quando todos os dias fechados estão apurados E há vendas no cache. */
  isCacheHit: boolean
  /** Vendas agregadas (cache dos dias fechados + hoje live). */
  vendas: VendaAgg[]
  split: PeriodSplit
}

/**
 * Cache de vendas da loja (Conveniência) em Supabase. HIT exige cobertura
 * completa em apuracao_diaria E presença de rows em apuracao_vendas — assim
 * uma apuração antiga (antes deste cache) cai em MISS e força refetch live.
 */
const useVendasCache = (input: UseVendasCacheInput): UseVendasCacheResult => {
  const rede = useTenantStore((s) => s.rede)
  const { dataInicial, dataFinal, empresaCodigo, empresasPermitidasCount } = input

  const split = useMemo(
    () => splitPeriodAtToday(dataInicial, dataFinal),
    [dataInicial, dataFinal]
  )

  const isEligible = !!rede && !!split.closedDays && empresasPermitidasCount > 0

  const closedIni = split.closedDays?.dataInicial ?? ''
  const closedEnd = split.closedDays?.dataFinal ?? ''
  const closedDaysCount = useMemo(
    () => (split.closedDays ? enumerateDays(split.closedDays.dataInicial, split.closedDays.dataFinal).length : 0),
    [split.closedDays]
  )
  const expectedScopeEmpresas = empresaCodigo != null ? 1 : empresasPermitidasCount
  const expectedCount = closedDaysCount * expectedScopeEmpresas

  // Probe 1: cobertura em apuracao_diaria (dia foi apurado).
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

  // Probe 2: pelo menos 1 row em apuracao_vendas. Sem isso, apuração antiga
  // (antes do cache de conveniência) acionaria HIT falso e zeraria as vendas.
  const { data: vendasProbeCount = 0, isLoading: loadingVendasProbe } = useQuery({
    queryKey: ['apuracao-vendas-probe', rede?.id, empresaCodigo ?? 'all', closedIni, closedEnd],
    queryFn: async () => {
      if (!supabase || !rede) return 0
      let query = supabase
        .from('apuracao_vendas')
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

  const loadingProbe = loadingDiariaProbe || loadingVendasProbe
  const isCacheHit =
    isEligible &&
    !loadingProbe &&
    diariaCount >= expectedCount &&
    expectedCount > 0 &&
    vendasProbeCount > 0

  // Só puxa o cache quando confirmamos HIT — evita SELECT grande à toa.
  const empresaCodigosForQuery = empresaCodigo != null ? [empresaCodigo] : undefined
  const { data: rows = [], isLoading: loadingRows } = useQuery({
    queryKey: ['apuracao-vendas', rede?.id, empresaCodigosForQuery?.join(',') ?? 'all', closedIni, closedEnd],
    queryFn: () =>
      fetchVendasCache({
        empresaCodigos: empresaCodigosForQuery,
        dataInicial: closedIni,
        dataFinal: closedEnd,
      }),
    enabled: isCacheHit,
    staleTime: 5 * 60 * 1000,
  })

  // HOJE — sempre live (volátil), só quando hoje está no período. Paginado por
  // cursor e agregado client-side pra ficar no mesmo shape do cache.
  const todayIni = split.todayPart?.dataInicial ?? ''
  const todayEnd = split.todayPart?.dataFinal ?? ''
  const { data: todayItens = [], isLoading: loadingToday } = useQuery({
    queryKey: ['vendas-cache-today', empresaCodigo ?? 'all', todayIni, todayEnd],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchVendaItens({
          empresaCodigo: empresaCodigo ?? undefined,
          dataInicial: todayIni, dataFinal: todayEnd,
          usaProdutoLmc: false,
          ultimoCodigo: p.ultimoCodigo, limite: p.limite,
        }),
        1000, 50
      ),
    enabled: isCacheHit && !!split.todayPart,
    staleTime: 60 * 1000,
  })

  const vendas = useMemo(() => {
    const fromCache = rows.map(cacheRowToVendaAgg)
    const fromToday = aggregateItensToVendaAgg(
      todayItens.filter((i) => empresaCodigo == null || i.empresaCodigo === empresaCodigo),
    )
    return [...fromCache, ...fromToday]
  }, [rows, todayItens, empresaCodigo])

  return {
    isEligible,
    isChecking: isEligible && (loadingProbe || (isCacheHit && (loadingRows || loadingToday))),
    isCacheHit: isCacheHit && !loadingRows,
    vendas,
    split,
  }
}

export default useVendasCache
