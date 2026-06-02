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
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
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

  // Safety net SÓ quando o cache de formas está VAZIO (modo de falha real: upsert
  // silencioso no apurarMes / RLS). No HIT normal (formas presentes) confia no
  // cache e NÃO refaz o fetch live paginado — esse fetch em todo HIT era o maior
  // peso residual da aba Caixas. Espera o cache de formas assentar antes de decidir.
  const liveFallbackEnabled = isCacheHit && empresaCodigo != null && !loadingFormas && formasRows.length === 0

  const { data: fallbackFormas = [], isLoading: loadingFallbackFormas } = useQuery({
    queryKey: ['formas-live-closed', empresaCodigo, closedIni, closedEnd],
    queryFn: async () => {
      console.warn('[useCaixasCache] fetching live formas for closed period:', {
        empresaCodigo, closedIni, closedEnd,
        cachedFormas: formasRows.length,
      })
      // Pagina via ultimoCodigo (até 20 páginas × 1000 = 20k formas/mês —
      // suficiente até pra postos com volume alto).
      const all = await fetchAllPages(
        (p) => fetchVendaFormasPagamento({
          empresaCodigo: empresaCodigo!,
          dataInicial: closedIni,
          dataFinal: closedEnd,
          ultimoCodigo: p.ultimoCodigo,
          limite: p.limite,
        }),
        1000,
        20,
      )
      console.warn('[useCaixasCache] live fetched', all.length, 'formas (paginated)')
      return all
    },
    enabled: liveFallbackEnabled,
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
  // Merge dedupe: cache + live closed + live today. Chave de dedupe inclui
  // venda_codigo + venda_prazo_codigo + forma_pagamento_codigo (forma é a parte
  // que diferencia múltiplos pagamentos da mesma venda).
  const formasPagamento = useMemo<VendaFormaPagamento[]>(() => {
    const seen = new Set<string>()
    const out: VendaFormaPagamento[] = []
    const consider = (fp: VendaFormaPagamento) => {
      const key = `${fp.vendaCodigo}-${fp.vendaPrazoCodigo}-${fp.formaPagamentoCodigo}`
      if (seen.has(key)) return
      seen.add(key)
      out.push(fp)
    }
    // Ordem: cache primeiro (mais rápido), depois live (preenche o que faltou)
    for (const r of formasRows) consider(cacheRowToFormaPagamento(r))
    for (const fp of fallbackFormas) consider(fp)
    for (const fp of todayFormasRaw?.resultados ?? []) consider(fp)
    return out
  }, [formasRows, fallbackFormas, todayFormasRaw])

  return {
    isCacheHit: isCacheHit && !loadingCaixas && !loadingFormas,
    isChecking:
      isEligible &&
      (loadingProbe ||
        (isCacheHit && (loadingCaixas || loadingFormas || loadingTodayCaixas || loadingTodayFormas || loadingFallbackFormas))),
    caixas,
    formasPagamento,
  }
}

export default useCaixasCache
