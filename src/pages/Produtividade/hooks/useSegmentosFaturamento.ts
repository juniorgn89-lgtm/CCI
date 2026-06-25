import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens, fetchVendaCodigosAutorizados } from '@/api/endpoints/vendas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { classifySetor } from '@/lib/setorClassification'
import { offsetPeriod, todayLocal } from '@/lib/period'
import useFuelVendaAnalytics from '@/pages/Operacao/hooks/useFuelVendaAnalytics'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import useVendaCodigosAutorizados from '@/hooks/useVendaCodigosAutorizados'
import type { VendaItem } from '@/api/types/venda'

/** Faturamento atual + comparativo de um segmento. */
export interface SegmentoFaturamento {
  faturamento: number
  faturamentoPrev: number
}

export interface SegmentosFaturamento {
  combustivel: SegmentoFaturamento
  automotivos: SegmentoFaturamento
  conveniencia: SegmentoFaturamento
  global: SegmentoFaturamento
  /** Rótulo do comparativo ("mês ant." / "ano ant."). */
  cmpLabel: string
  isLoading: boolean
  hasEmpresa: boolean
}

/** Ref estável p/ default da query de set (evita novo Set por render). */
const EMPTY_SET: Set<number> = new Set()

/**
 * Faturamento por segmento (Combustível / Automotivos / Conveniência / Global)
 * pro modo "Todos" da Produtividade. Reusa as MESMAS fontes da
 * Vendas · Visão Geral:
 *  - Combustível: useFuelVendaAnalytics → kpis.faturamento / cmp.faturamento
 *  - Conveniência: useConvenienceData → kpis.faturamento / kpis.cmp.faturamento
 *  - Automotivos (pista): produtos PS- (classifySetor === 'automotivos') somando
 *    totalVenda dos /VENDA_ITEM autorizados. O período ATUAL reaproveita as
 *    queryKeys de produtos/grupos/vendaItens-pista/venda-autorizados (dedup com
 *    a Visão Geral); o período ANTERIOR usa o mesmo span deslocado pelo
 *    comparisonMode (prevYear=12 meses, senão 1 mês).
 *
 * O comparativo segue a regra "mesmos dias decorridos" (corta o fim em hoje
 * antes de deslocar), igual aos hooks de combustível e conveniência — assim os
 * 3 segmentos comparam contra a mesma janela.
 */
const useSegmentosFaturamento = (empresaCodigoOverride?: number | null): SegmentosFaturamento => {
  const { empresaCodigos: filterCodes, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  // Posto explícito (seletor) tem prioridade; senão o filtro global.
  const empresaCodigos = empresaCodigoOverride !== undefined
    ? (empresaCodigoOverride !== null ? [empresaCodigoOverride] : [])
    : filterCodes
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1

  // "Mesmos dias decorridos": corta o fim em hoje antes de deslocar, pra mês
  // corrente parcial não comparar contra período cheio do passado.
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const prevInicial = offsetPeriod(dataInicial, cmpOffset)
  const prevFinal = offsetPeriod(fimEfetivo, cmpOffset)

  // ── Combustível + Conveniência: reusam os hooks existentes (queryKeys
  // compartilhadas → uma fetch serve as duas telas). ──
  const { kpis: fuelKpis, cmp: fuelCmp, isLoading: isLoadingFuel } = useFuelVendaAnalytics(empresaCodigoOverride)
  const { kpis: convKpis, isLoading: isLoadingConv } = useConvenienceData(empresaCodigoOverride)

  // ── Automotivos (pista): catálogo de produtos + grupos (mesmas queryKeys da
  // Visão Geral e demais telas). ──
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })
  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Período ATUAL — mesma queryKey da Visão Geral (['vendaItens-pista', ...]).
  const { data: vendaItens = [], isLoading: isLoadingVendas } = useQuery({
    queryKey: ['vendaItens-pista', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo!,
        dataInicial,
        dataFinal,
        usaProdutoLmc: false,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50,
    ),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 5 * 60 * 1000,
  })

  // Período ANTERIOR — mesma forma de queryKey, só com as datas deslocadas.
  const { data: vendaItensPrev = [] } = useQuery<VendaItem[]>({
    queryKey: ['vendaItens-pista', empresaCodigo, prevInicial, prevFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo!,
        dataInicial: prevInicial,
        dataFinal: prevFinal,
        usaProdutoLmc: false,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50,
    ),
    enabled: hasEmpresa && empresaCodigo !== null && !!prevInicial && !!prevFinal,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Cruzamento /VENDA (situacao='A') — exclui cancelados.
  // Atual: reusa useVendaCodigosAutorizados (mesma queryKey ['venda-autorizados', ...]).
  const { autorizados } = useVendaCodigosAutorizados(empresaCodigos, dataInicial, dataFinal, hasEmpresa)
  // Anterior: mesma queryKey deslocada → dedup com qualquer outra tela que já
  // tenha buscado os autorizados desse período.
  const { data: autorizadosPrev = EMPTY_SET } = useQuery<Set<number>>({
    queryKey: ['venda-autorizados', empresaCodigos.join(','), prevInicial, prevFinal],
    queryFn: async () => {
      const sets = await Promise.all(
        empresaCodigos.map((emp) =>
          fetchVendaCodigosAutorizados({ empresaCodigo: emp, dataInicial: prevInicial, dataFinal: prevFinal }),
        ),
      )
      const all = new Set<number>()
      for (const s of sets) for (const c of s) all.add(c)
      return all
    },
    enabled: hasEmpresa && !!prevInicial && !!prevFinal,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Set de produtos automotivos (PS-) — derivado de produtos + grupos.
  const psCodigos = useMemo(() => {
    const set = new Set<number>()
    if (!produtosData || !gruposData) return set
    const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
    for (const p of produtosData) {
      if (classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'automotivos') {
        set.add(p.produtoCodigo)
      }
    }
    return set
  }, [produtosData, gruposData])

  // Soma totalVenda dos itens automotivos autorizados de uma janela.
  const sumPista = (itens: VendaItem[], aut: Set<number>): number => {
    if (psCodigos.size === 0) return 0
    let fat = 0
    for (const item of itens) {
      if (!aut.has(item.vendaCodigo)) continue
      if (psCodigos.has(item.produtoCodigo)) fat += item.totalVenda
    }
    return fat
  }

  const pistaFat = useMemo(
    () => sumPista(vendaItens, autorizados),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendaItens, autorizados, psCodigos],
  )
  const pistaFatPrev = useMemo(
    () => sumPista(vendaItensPrev, autorizadosPrev),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendaItensPrev, autorizadosPrev, psCodigos],
  )

  const combustivel: SegmentoFaturamento = {
    faturamento: fuelKpis.faturamento,
    faturamentoPrev: fuelCmp.faturamento,
  }
  const conveniencia: SegmentoFaturamento = {
    faturamento: convKpis?.faturamento ?? 0,
    faturamentoPrev: convKpis?.cmp.faturamento ?? 0,
  }
  const automotivos: SegmentoFaturamento = {
    faturamento: pistaFat,
    faturamentoPrev: pistaFatPrev,
  }
  const global: SegmentoFaturamento = {
    faturamento: combustivel.faturamento + automotivos.faturamento + conveniencia.faturamento,
    faturamentoPrev: combustivel.faturamentoPrev + automotivos.faturamentoPrev + conveniencia.faturamentoPrev,
  }

  return {
    combustivel,
    automotivos,
    conveniencia,
    global,
    cmpLabel,
    isLoading: isLoadingFuel || isLoadingConv || isLoadingVendas,
    hasEmpresa,
  }
}

export default useSegmentosFaturamento
