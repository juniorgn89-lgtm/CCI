import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoque } from '@/api/endpoints/estoques'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

/* ── Types ───────────────────────────────────────────────── */

export interface ConvKpiData {
  faturamento: number
  margem: number
  margemPct: number
  qtdItens: number
  ticketMedio: number
  totalProdutos: number
  prev: {
    faturamento: number
    margem: number
    qtdItens: number
  }
}

export interface DailyRow {
  data: string
  faturamento: number
  custo: number
  margemRs: number
  margemPct: number
  qtdItens: number
  ticketMedio: number
  [key: string]: unknown
}

export interface GroupRow {
  grupoCodigo: number
  nome: string
  faturamento: number
  quantidade: number
  margemTotal: number
  margemPct: number
  [key: string]: unknown
}

export interface RevenueRow {
  mes: string
  faturamento: number
  margem: number
}

export interface CatalogProduct {
  produtoCodigo: number
  nome: string
  grupo: string
  grupoCodigo: number
  precoMedioVenda: number
  custoMedio: number
  margemPct: number
  qtdVendida: number
  faturamento: number
  ativo: boolean
  unidade: string
  [key: string]: unknown
}

export interface StockItem {
  produtoCodigo: number
  nome: string
  grupo: string
  saldo: number
  custoMedio: number
  valorEstoque: number
  status: 'normal' | 'baixo' | 'zerado'
  [key: string]: unknown
}

export interface TopSellerItem {
  produtoCodigo: number
  nome: string
  grupo: string
  quantidade: number
  faturamento: number
  lucroBruto: number
  participacaoPct: number
}

export interface PerformanceProduct {
  produtoCodigo: number
  nome: string
  grupo: string
  faturamento: number
  quantidade: number
  margemPct: number
  lucroBruto: number
  classificacao: 'alta-margem' | 'alto-volume' | 'baixa-saida'
}

export interface InsightItem {
  type: 'positive' | 'warning' | 'info'
  title: string
  description: string
}

/* ── Helper: previous month range ────────────────────────── */

const getPrevMonthRange = (dataInicial: string) => {
  const d = new Date(dataInicial)
  d.setMonth(d.getMonth() - 1)
  const y = d.getFullYear()
  const m = d.getMonth()
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`
  return { dataInicial: first, dataFinal: last }
}

/** Returns range covering the last N full months before dataInicial */
const getEvolutionRange = (dataInicial: string, months: number) => {
  const d = new Date(dataInicial)
  d.setMonth(d.getMonth() - months)
  const yStart = d.getFullYear()
  const mStart = d.getMonth()
  const first = `${yStart}-${String(mStart + 1).padStart(2, '0')}-01`
  // End = last day of month before the current period's start month
  const end = new Date(dataInicial)
  end.setDate(0) // last day of previous month
  const last = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return { dataInicial: first, dataFinal: last }
}

/* ── Hook ────────────────────────────────────────────────── */

const useConvenienceData = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const prevMonth = getPrevMonthRange(dataInicial)
  const evolutionRange = getEvolutionRange(dataInicial, 3) // last 3 months before current period

  const filterParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
    usaProdutoLmc: false,
  }

  // Current period venda itens (non-fuel) — paginated
  const { data: vendaItensData, isLoading: l1 } = useQuery({
    queryKey: ['vendaItensAll', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 50
    ),
    enabled: hasEmpresa,
  })

  // Previous month venda itens (for KPI comparison) — paginated
  const { data: prevMonthData, isLoading: l2 } = useQuery({
    queryKey: ['vendaItensAll', empresaCodigo, prevMonth.dataInicial, prevMonth.dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo ?? undefined,
        dataInicial: prevMonth.dataInicial,
        dataFinal: prevMonth.dataFinal,
        usaProdutoLmc: false,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50
    ),
    enabled: hasEmpresa,
  })

  // Historical months for evolution chart (fills gap between prevMonth and current)
  const { data: evolutionData, isLoading: l6 } = useQuery({
    queryKey: ['vendaItensAll', empresaCodigo, evolutionRange.dataInicial, evolutionRange.dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo ?? undefined,
        dataInicial: evolutionRange.dataInicial,
        dataFinal: evolutionRange.dataFinal,
        usaProdutoLmc: false,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50
    ),
    enabled: hasEmpresa,
    staleTime: 10 * 60 * 1000,
  })

  // Products (cached)
  const { data: produtosData, isLoading: l3 } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Groups (cached)
  const { data: gruposData, isLoading: l4 } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Stock levels (direct call, not fetchAllPages — API returns flat list)
  const { data: estoqueRaw, isLoading: l5 } = useQuery({
    queryKey: ['produtoEstoque', empresaCodigo],
    queryFn: () => fetchProdutoEstoque({
      empresaCodigo: empresaCodigo!,
      limite: 1000,
    }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6

  const computed = useMemo(() => {
    const vendaItens = vendaItensData ?? []
    const prevItens = prevMonthData ?? []
    const histItens = evolutionData ?? []
    const produtos = produtosData ?? []
    const grupos = gruposData ?? []
    const estoque = estoqueRaw?.resultados ?? []

    // ── Maps ──
    const produtoMap = new Map<number, { nome: string; grupoCodigo: number; ativo: boolean; unidade: string }>()
    for (const p of produtos) {
      // Filter: only non-fuel products (conveniência)
      if (!p.combustivel) {
        produtoMap.set(p.produtoCodigo, {
          nome: p.nome,
          grupoCodigo: p.grupoCodigo,
          ativo: p.ativo,
          unidade: p.unidadeVenda || 'UN',
        })
      }
    }
    const grupoMap = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))

    const getName = (code: number) => produtoMap.get(code)?.nome ?? `Produto ${code}`
    const getGroup = (code: number) => {
      const gc = produtoMap.get(code)?.grupoCodigo
      return gc ? (grupoMap.get(gc) ?? 'Sem grupo') : 'Sem grupo'
    }
    const getGroupCode = (code: number) => produtoMap.get(code)?.grupoCodigo ?? 0

    // Filter vendaItens to non-fuel only
    const convItens = vendaItens.filter((i) => produtoMap.has(i.produtoCodigo))
    const convPrevItens = prevItens.filter((i) => produtoMap.has(i.produtoCodigo))

    // ── Aggregate by product (current) ──
    const byProduct = new Map<number, { faturamento: number; quantidade: number; custo: number; count: number }>()
    for (const item of convItens) {
      const prev = byProduct.get(item.produtoCodigo) ?? { faturamento: 0, quantidade: 0, custo: 0, count: 0 }
      byProduct.set(item.produtoCodigo, {
        faturamento: prev.faturamento + item.totalVenda,
        quantidade: prev.quantidade + item.quantidade,
        custo: prev.custo + item.totalCusto,
        count: prev.count + 1,
      })
    }

    // ── Aggregate prev month by product ──
    const byProductPrev = new Map<number, { faturamento: number; quantidade: number }>()
    for (const item of convPrevItens) {
      const prev = byProductPrev.get(item.produtoCodigo) ?? { faturamento: 0, quantidade: 0 }
      byProductPrev.set(item.produtoCodigo, {
        faturamento: prev.faturamento + item.totalVenda,
        quantidade: prev.quantidade + item.quantidade,
      })
    }

    // ── KPIs ──
    const totalFat = convItens.reduce((s, i) => s + i.totalVenda, 0)
    const totalCusto = convItens.reduce((s, i) => s + i.totalCusto, 0)
    const totalQtd = convItens.reduce((s, i) => s + i.quantidade, 0)
    const totalMargem = totalFat - totalCusto
    const margemPct = totalFat > 0 ? (totalMargem / totalFat) * 100 : 0
    const ticketMedio = convItens.length > 0 ? totalFat / convItens.length : 0

    const prevFat = convPrevItens.reduce((s, i) => s + i.totalVenda, 0)
    const prevCusto = convPrevItens.reduce((s, i) => s + i.totalCusto, 0)
    const prevQtd = convPrevItens.reduce((s, i) => s + i.quantidade, 0)

    const kpis: ConvKpiData = {
      faturamento: totalFat,
      margem: totalMargem,
      margemPct,
      qtdItens: totalQtd,
      ticketMedio,
      totalProdutos: byProduct.size,
      prev: {
        faturamento: prevFat,
        margem: prevFat - prevCusto,
        qtdItens: prevQtd,
      },
    }

    // ── Daily data ──
    const byDay = new Map<string, { faturamento: number; custo: number; qtdItens: number; count: number }>()
    for (const item of convItens) {
      const day = item.dataMovimento.split('T')[0]
      const prev = byDay.get(day) ?? { faturamento: 0, custo: 0, qtdItens: 0, count: 0 }
      byDay.set(day, {
        faturamento: prev.faturamento + item.totalVenda,
        custo: prev.custo + item.totalCusto,
        qtdItens: prev.qtdItens + item.quantidade,
        count: prev.count + 1,
      })
    }
    const dailyData: DailyRow[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => {
        const margemRs = v.faturamento - v.custo
        return {
          data,
          faturamento: v.faturamento,
          custo: v.custo,
          margemRs,
          margemPct: v.faturamento > 0 ? (margemRs / v.faturamento) * 100 : 0,
          qtdItens: v.qtdItens,
          ticketMedio: v.count > 0 ? v.faturamento / v.count : 0,
        }
      })

    // ── Group breakdown ──
    const byGrupo = new Map<number, { faturamento: number; quantidade: number; custo: number }>()
    for (const item of convItens) {
      const gc = getGroupCode(item.produtoCodigo)
      const prev = byGrupo.get(gc) ?? { faturamento: 0, quantidade: 0, custo: 0 }
      byGrupo.set(gc, {
        faturamento: prev.faturamento + item.totalVenda,
        quantidade: prev.quantidade + item.quantidade,
        custo: prev.custo + item.totalCusto,
      })
    }
    const groupTable: GroupRow[] = Array.from(byGrupo.entries())
      .map(([gc, v]) => ({
        grupoCodigo: gc,
        nome: grupoMap.get(gc) ?? 'Sem grupo',
        faturamento: v.faturamento,
        quantidade: v.quantidade,
        margemTotal: v.faturamento - v.custo,
        margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)

    // ── Monthly evolution (historical + previous + current) ──
    const byMonth = new Map<string, { faturamento: number; custo: number }>()
    const addToMonth = (items: typeof convItens, filterByProdutoMap = false) => {
      for (const item of items) {
        if (filterByProdutoMap && !produtoMap.has(item.produtoCodigo)) continue
        const month = item.dataMovimento.substring(0, 7)
        const prev = byMonth.get(month) ?? { faturamento: 0, custo: 0 }
        byMonth.set(month, {
          faturamento: prev.faturamento + item.totalVenda,
          custo: prev.custo + item.totalCusto,
        })
      }
    }
    addToMonth(histItens, true)   // historical months (filter non-fuel)
    addToMonth(prevItens, true)   // previous month (filter non-fuel)
    addToMonth(convItens, false)  // current period (already filtered)
    const revenueData: RevenueRow[] = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-')
        return {
          mes: `${m}/${y}`,
          faturamento: v.faturamento,
          margem: v.faturamento - v.custo,
        }
      })

    // ── Product catalog ──
    const catalogProducts: CatalogProduct[] = Array.from(byProduct.entries())
      .map(([code, v]) => {
        const info = produtoMap.get(code)
        return {
          produtoCodigo: code,
          nome: getName(code),
          grupo: getGroup(code),
          grupoCodigo: getGroupCode(code),
          precoMedioVenda: v.quantidade > 0 ? v.faturamento / v.quantidade : 0,
          custoMedio: v.quantidade > 0 ? v.custo / v.quantidade : 0,
          margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
          qtdVendida: v.quantidade,
          faturamento: v.faturamento,
          ativo: info?.ativo ?? true,
          unidade: info?.unidade ?? 'UN',
        }
      })
      .sort((a, b) => b.faturamento - a.faturamento)

    // ── Stock items ──
    const estoqueMap = new Map<number, number>()
    for (const e of estoque) {
      estoqueMap.set(e.produtoCodigo, (estoqueMap.get(e.produtoCodigo) ?? 0) + e.saldo)
    }

    const stockItems: StockItem[] = []
    for (const [code, saldo] of estoqueMap.entries()) {
      if (!produtoMap.has(code)) continue
      const prod = byProduct.get(code)
      const custoMedio = prod && prod.quantidade > 0 ? prod.custo / prod.quantidade : 0
      stockItems.push({
        produtoCodigo: code,
        nome: getName(code),
        grupo: getGroup(code),
        saldo,
        custoMedio,
        valorEstoque: saldo * custoMedio,
        status: saldo <= 0 ? 'zerado' : saldo <= 5 ? 'baixo' : 'normal',
      })
    }
    stockItems.sort((a, b) => a.status === 'zerado' ? -1 : b.status === 'zerado' ? 1 : a.saldo - b.saldo)

    const stockSummary = {
      totalItens: stockItems.length,
      valorTotal: stockItems.reduce((s, i) => s + i.valorEstoque, 0),
      baixoEstoque: stockItems.filter((i) => i.status === 'baixo').length,
      zerado: stockItems.filter((i) => i.status === 'zerado').length,
    }

    // ── Top sellers ──
    const topSellers: TopSellerItem[] = [...catalogProducts]
      .sort((a, b) => b.qtdVendida - a.qtdVendida)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        quantidade: p.qtdVendida,
        faturamento: p.faturamento,
        lucroBruto: p.faturamento - (p.custoMedio * p.qtdVendida),
        participacaoPct: totalFat > 0 ? (p.faturamento / totalFat) * 100 : 0,
      }))

    // Treemap data (by group)
    const treemapData = groupTable.map((g) => ({
      name: g.nome,
      value: g.faturamento,
      quantidade: g.quantidade,
    }))

    // ── Performance analysis ──
    const allProducts = catalogProducts.map((p) => ({
      ...p,
      lucroBruto: p.faturamento - (p.custoMedio * p.qtdVendida),
    }))

    const highMargin: PerformanceProduct[] = [...allProducts]
      .filter((p) => p.margemPct > 0)
      .sort((a, b) => b.margemPct - a.margemPct)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        faturamento: p.faturamento,
        quantidade: p.qtdVendida,
        margemPct: p.margemPct,
        lucroBruto: p.lucroBruto,
        classificacao: 'alta-margem' as const,
      }))

    const highVolume: PerformanceProduct[] = [...allProducts]
      .sort((a, b) => b.qtdVendida - a.qtdVendida)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        faturamento: p.faturamento,
        quantidade: p.qtdVendida,
        margemPct: p.margemPct,
        lucroBruto: p.lucroBruto,
        classificacao: 'alto-volume' as const,
      }))

    const lowSales: PerformanceProduct[] = [...allProducts]
      .filter((p) => p.qtdVendida > 0)
      .sort((a, b) => a.qtdVendida - b.qtdVendida)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        faturamento: p.faturamento,
        quantidade: p.qtdVendida,
        margemPct: p.margemPct,
        lucroBruto: p.lucroBruto,
        classificacao: 'baixa-saida' as const,
      }))

    // ── Insights ──
    const insights: InsightItem[] = []

    // Top seller insight
    if (topSellers.length > 0) {
      const top = topSellers[0]
      insights.push({
        type: 'positive',
        title: `${top.nome} lidera as vendas`,
        description: `Com ${top.quantidade.toLocaleString('pt-BR')} unidades vendidas, representa ${top.participacaoPct.toFixed(1)}% do faturamento total da conveniência.`,
      })
    }

    // Month-over-month growth
    if (prevFat > 0 && totalFat > 0) {
      const growthPct = ((totalFat - prevFat) / prevFat) * 100
      if (growthPct > 0) {
        insights.push({
          type: 'positive',
          title: `Crescimento de ${growthPct.toFixed(1)}% nas vendas`,
          description: `A conveniência faturou mais neste período comparado ao mês anterior.`,
        })
      } else {
        insights.push({
          type: 'warning',
          title: `Queda de ${Math.abs(growthPct).toFixed(1)}% nas vendas`,
          description: `O faturamento caiu em relação ao mês anterior. Avalie promoções e mix de produtos.`,
        })
      }
    }

    // High margin products
    if (highMargin.length > 0 && highMargin[0].margemPct > 30) {
      insights.push({
        type: 'positive',
        title: `${highMargin[0].nome} tem margem de ${highMargin[0].margemPct.toFixed(1)}%`,
        description: `Produto com excelente rentabilidade. Considere destacá-lo na loja.`,
      })
    }

    // Low sales products
    if (lowSales.length > 0) {
      const lowCount = lowSales.filter((p) => p.quantidade <= 3).length
      if (lowCount > 3) {
        insights.push({
          type: 'warning',
          title: `${lowCount} produtos com baixa rotatividade`,
          description: `Esses produtos tiveram menos de 3 unidades vendidas no período. Revise a estratégia.`,
        })
      }
    }

    // Stock alerts
    if (stockSummary.zerado > 0) {
      insights.push({
        type: 'warning',
        title: `${stockSummary.zerado} produtos com estoque zerado`,
        description: `Produtos sem estoque podem representar perda de vendas. Verifique reposição.`,
      })
    }

    // Best performing group
    if (groupTable.length > 0) {
      const bestGroup = groupTable[0]
      insights.push({
        type: 'info',
        title: `Grupo "${bestGroup.nome}" é o mais rentável`,
        description: `Responsável por R$ ${bestGroup.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em faturamento com margem de ${bestGroup.margemPct.toFixed(1)}%.`,
      })
    }

    // Average ticket insight
    if (ticketMedio > 0) {
      insights.push({
        type: 'info',
        title: `Ticket médio de R$ ${ticketMedio.toFixed(2)}`,
        description: `Cada venda da conveniência gera em média esse valor. Estratégias de cross-selling podem elevar esse indicador.`,
      })
    }

    // Groups list for filters
    const gruposList = [...new Set(catalogProducts.map((p) => p.grupo))].sort()

    return {
      kpis,
      dailyData,
      groupTable,
      revenueData,
      catalogProducts,
      stockItems,
      stockSummary,
      topSellers,
      treemapData,
      highMargin,
      highVolume,
      lowSales,
      insights,
      gruposList,
    }
  }, [vendaItensData, prevMonthData, evolutionData, produtosData, gruposData, estoqueRaw])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
  }
}

export default useConvenienceData
