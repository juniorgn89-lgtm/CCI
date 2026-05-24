import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoque } from '@/api/endpoints/estoques'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { smoothedProjection, movingAverageDailyRate } from '@/lib/projection'
import useVendasCache, { aggregateItensToVendaAgg } from '@/pages/Conveniencias/hooks/useVendasCache'

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
    margemPct: number
    ticketMedio: number
    qtdItens: number
  }
}

/** Projeção de vendas do período: extrapola o mês corrente e compara ao mês anterior. */
export interface ProjecaoVendas {
  /** Faturamento projetado pro fim do período (= realizado em meses fechados). */
  faturamento: number
  /** Lucro bruto projetado pro fim do período (= realizado em meses fechados). */
  lucroBruto: number
  /** Faturamento do mês anterior (base de comparação). */
  comparativo: number
  /** Variação % do projetado vs mês anterior. */
  variacao: number
  /**
   * True só quando o período tem dias futuros (há o que projetar) — modo
   * "Completo" do mês corrente. Em "Apurado"/"Em andamento" não há futuro, então
   * `faturamento` = realizado e a projeção não é real (a UI avisa o usuário).
   */
  isProjetada: boolean
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

/** Um produto vendido num dia específico — usado no modal de detalhe do dia. */
export interface DaySaleProduct {
  produtoCodigo: number
  nome: string
  grupo: string
  quantidade: number
  faturamento: number
  custo: number
  margemRs: number
  margemPct: number
  [key: string]: unknown
}

/**
 * Série diária pro gráfico "Vendas Diárias" cobrindo o período inteiro:
 * dias passados/hoje vêm como `faturamento` (real) e os dias que faltam até o
 * fim do período como `projetado` (média móvel suavizada). `margemRs` só nos
 * dias reais (a linha de margem para em hoje).
 */
export interface DailyChartRow {
  data: string
  faturamento: number | null
  projetado: number | null
  margemRs: number | null
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
  /** Saldo atual em estoque (soma de todos os estoques do posto). Undefined
   * quando o produto não tem registro de estoque (serviços etc.). */
  saldo?: number
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

  // Cache de vendas (apuracao_vendas) pra current + prev + evolução.
  // HIT = pula fetch live; MISS = fetch live como antes (sem regressão).
  const vendasCacheCurrent = useVendasCache({ dataInicial, dataFinal, empresaCodigo, empresasPermitidasCount: 1 })
  const vendasCachePrev = useVendasCache({ dataInicial: prevMonth.dataInicial, dataFinal: prevMonth.dataFinal, empresaCodigo, empresasPermitidasCount: 1 })
  const vendasCacheEvo = useVendasCache({ dataInicial: evolutionRange.dataInicial, dataFinal: evolutionRange.dataFinal, empresaCodigo, empresasPermitidasCount: 1 })

  const filterParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
    usaProdutoLmc: false,
  }

  // Current period venda itens (non-fuel) — live só quando cache MISS.
  const { data: vendaItensData, isLoading: l1 } = useQuery({
    queryKey: ['vendaItensAll', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 50
    ),
    enabled: hasEmpresa && !vendasCacheCurrent.isCacheHit && !vendasCacheCurrent.isChecking,
  })

  // Previous month venda itens (for KPI comparison) — live só quando cache MISS.
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
    enabled: hasEmpresa && !vendasCachePrev.isCacheHit && !vendasCachePrev.isChecking,
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
    enabled: hasEmpresa && !vendasCacheEvo.isCacheHit && !vendasCacheEvo.isChecking,
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

  const isLoading =
    (l1 && !vendasCacheCurrent.isCacheHit) ||
    (l2 && !vendasCachePrev.isCacheHit) ||
    (l6 && !vendasCacheEvo.isCacheHit) ||
    vendasCacheCurrent.isChecking ||
    vendasCachePrev.isChecking ||
    vendasCacheEvo.isChecking ||
    l3 || l4 || l5

  const computed = useMemo(() => {
    // Vendas vêm do cache Supabase quando HIT; senão, agregadas do live.
    const filterEmpresa = (i: { empresaCodigo: number }) =>
      empresaCodigo == null || i.empresaCodigo === empresaCodigo
    const vendaAggs = vendasCacheCurrent.isCacheHit
      ? vendasCacheCurrent.vendas
      : aggregateItensToVendaAgg((vendaItensData ?? []).filter(filterEmpresa))
    const prevAggs = vendasCachePrev.isCacheHit
      ? vendasCachePrev.vendas
      : aggregateItensToVendaAgg((prevMonthData ?? []).filter(filterEmpresa))
    const histAggs = vendasCacheEvo.isCacheHit
      ? vendasCacheEvo.vendas
      : aggregateItensToVendaAgg((evolutionData ?? []).filter(filterEmpresa))
    const produtos = produtosData ?? []
    const grupos = gruposData ?? []
    const estoque = estoqueRaw?.resultados ?? []

    // ── Maps ──
    // grupoMap construído PRIMEIRO porque produtoMap filtra pelo nome
    // do grupo pra excluir produtos da pista (PS-) — esses vivem em
    // /comercial/vendas/pista, não em Conveniências.
    const grupoMap = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))

    const produtoMap = new Map<number, { nome: string; grupoCodigo: number; ativo: boolean; unidade: string }>()
    for (const p of produtos) {
      // Skip combustível — Conveniência é só loja
      if (p.combustivel) continue
      // Skip produtos da pista (PS-) — vivem em /comercial/vendas/pista
      const grupoNome = grupoMap.get(p.grupoCodigo) ?? ''
      if (grupoNome.startsWith('PS -')) continue
      produtoMap.set(p.produtoCodigo, {
        nome: p.nome,
        grupoCodigo: p.grupoCodigo,
        ativo: p.ativo,
        unidade: p.unidadeVenda || 'UN',
      })
    }

    const getName = (code: number) => produtoMap.get(code)?.nome ?? `Produto ${code}`
    const getGroup = (code: number) => {
      const gc = produtoMap.get(code)?.grupoCodigo
      return gc ? (grupoMap.get(gc) ?? 'Sem grupo') : 'Sem grupo'
    }
    const getGroupCode = (code: number) => produtoMap.get(code)?.grupoCodigo ?? 0

    // Filter aggregates to non-fuel only (produtoMap exclui combustível + PS-)
    const convAggs = vendaAggs.filter((a) => produtoMap.has(a.produtoCodigo))
    const convPrevAggs = prevAggs.filter((a) => produtoMap.has(a.produtoCodigo))

    // ── Aggregate by product (current) ──
    // `count` soma `linhas` (nº de itens de venda) pra preservar o ticket médio.
    const byProduct = new Map<number, { faturamento: number; quantidade: number; custo: number; count: number }>()
    for (const a of convAggs) {
      const prev = byProduct.get(a.produtoCodigo) ?? { faturamento: 0, quantidade: 0, custo: 0, count: 0 }
      byProduct.set(a.produtoCodigo, {
        faturamento: prev.faturamento + a.totalVenda,
        quantidade: prev.quantidade + a.quantidade,
        custo: prev.custo + a.totalCusto,
        count: prev.count + a.linhas,
      })
    }

    // ── Aggregate prev month by product ──
    const byProductPrev = new Map<number, { faturamento: number; quantidade: number }>()
    for (const a of convPrevAggs) {
      const prev = byProductPrev.get(a.produtoCodigo) ?? { faturamento: 0, quantidade: 0 }
      byProductPrev.set(a.produtoCodigo, {
        faturamento: prev.faturamento + a.totalVenda,
        quantidade: prev.quantidade + a.quantidade,
      })
    }

    // ── KPIs ──
    const totalFat = convAggs.reduce((s, a) => s + a.totalVenda, 0)
    const totalCusto = convAggs.reduce((s, a) => s + a.totalCusto, 0)
    const totalQtd = convAggs.reduce((s, a) => s + a.quantidade, 0)
    const totalLinhas = convAggs.reduce((s, a) => s + a.linhas, 0)
    const totalMargem = totalFat - totalCusto
    const margemPct = totalFat > 0 ? (totalMargem / totalFat) * 100 : 0
    // Ticket médio = faturamento ÷ nº de itens de venda (linhas), não transações.
    const ticketMedio = totalLinhas > 0 ? totalFat / totalLinhas : 0

    const prevFat = convPrevAggs.reduce((s, a) => s + a.totalVenda, 0)
    const prevCusto = convPrevAggs.reduce((s, a) => s + a.totalCusto, 0)
    const prevQtd = convPrevAggs.reduce((s, a) => s + a.quantidade, 0)
    const prevLinhas = convPrevAggs.reduce((s, a) => s + a.linhas, 0)
    const prevMargemPct = prevFat > 0 ? ((prevFat - prevCusto) / prevFat) * 100 : 0
    const prevTicket = prevLinhas > 0 ? prevFat / prevLinhas : 0

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
        margemPct: prevMargemPct,
        ticketMedio: prevTicket,
        qtdItens: prevQtd,
      },
    }

    // ── Daily data ──
    const byDay = new Map<string, { faturamento: number; custo: number; qtdItens: number; count: number }>()
    for (const a of convAggs) {
      const day = a.data
      const prev = byDay.get(day) ?? { faturamento: 0, custo: 0, qtdItens: 0, count: 0 }
      byDay.set(day, {
        faturamento: prev.faturamento + a.totalVenda,
        custo: prev.custo + a.totalCusto,
        qtdItens: prev.qtdItens + a.quantidade,
        count: prev.count + a.linhas,
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

    // ── Produtos vendidos por dia (pro modal de detalhe do dia) ──
    // Reaproveita os agregados já em memória — sem nenhuma chamada extra.
    const byDayProduto = new Map<string, Map<number, { quantidade: number; faturamento: number; custo: number }>>()
    for (const a of convAggs) {
      const dayMap = byDayProduto.get(a.data) ?? new Map<number, { quantidade: number; faturamento: number; custo: number }>()
      const p = dayMap.get(a.produtoCodigo) ?? { quantidade: 0, faturamento: 0, custo: 0 }
      p.quantidade += a.quantidade
      p.faturamento += a.totalVenda
      p.custo += a.totalCusto
      dayMap.set(a.produtoCodigo, p)
      byDayProduto.set(a.data, dayMap)
    }
    const salesByDay: Record<string, DaySaleProduct[]> = {}
    for (const [day, dayMap] of byDayProduto) {
      const list: DaySaleProduct[] = []
      for (const [code, v] of dayMap) {
        const margemRs = v.faturamento - v.custo
        list.push({
          produtoCodigo: code,
          nome: getName(code),
          grupo: getGroup(code),
          quantidade: v.quantidade,
          faturamento: v.faturamento,
          custo: v.custo,
          margemRs,
          margemPct: v.faturamento > 0 ? (margemRs / v.faturamento) * 100 : 0,
        })
      }
      list.sort((a, b) => b.faturamento - a.faturamento)
      salesByDay[day] = list
    }

    // ── Produtos por grupo (pro modal de detalhe do grupo) ──
    const byGrupoProduto = new Map<number, Map<number, { quantidade: number; faturamento: number; custo: number }>>()
    for (const a of convAggs) {
      const gc = getGroupCode(a.produtoCodigo)
      const gMap = byGrupoProduto.get(gc) ?? new Map<number, { quantidade: number; faturamento: number; custo: number }>()
      const p = gMap.get(a.produtoCodigo) ?? { quantidade: 0, faturamento: 0, custo: 0 }
      p.quantidade += a.quantidade
      p.faturamento += a.totalVenda
      p.custo += a.totalCusto
      gMap.set(a.produtoCodigo, p)
      byGrupoProduto.set(gc, gMap)
    }
    const productsByGroup: Record<number, DaySaleProduct[]> = {}
    for (const [gc, gMap] of byGrupoProduto) {
      const list: DaySaleProduct[] = []
      for (const [code, v] of gMap) {
        const margemRs = v.faturamento - v.custo
        list.push({
          produtoCodigo: code,
          nome: getName(code),
          grupo: getGroup(code),
          quantidade: v.quantidade,
          faturamento: v.faturamento,
          custo: v.custo,
          margemRs,
          margemPct: v.faturamento > 0 ? (margemRs / v.faturamento) * 100 : 0,
        })
      }
      list.sort((a, b) => b.faturamento - a.faturamento)
      productsByGroup[gc] = list
    }

    // ── Group breakdown ──
    const byGrupo = new Map<number, { faturamento: number; quantidade: number; custo: number }>()
    for (const a of convAggs) {
      const gc = getGroupCode(a.produtoCodigo)
      const prev = byGrupo.get(gc) ?? { faturamento: 0, quantidade: 0, custo: 0 }
      byGrupo.set(gc, {
        faturamento: prev.faturamento + a.totalVenda,
        quantidade: prev.quantidade + a.quantidade,
        custo: prev.custo + a.totalCusto,
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
    const addToMonth = (aggs: typeof convAggs, filterByProdutoMap = false) => {
      for (const a of aggs) {
        if (filterByProdutoMap && !produtoMap.has(a.produtoCodigo)) continue
        const month = a.data.substring(0, 7)
        const prev = byMonth.get(month) ?? { faturamento: 0, custo: 0 }
        byMonth.set(month, {
          faturamento: prev.faturamento + a.totalVenda,
          custo: prev.custo + a.totalCusto,
        })
      }
    }
    addToMonth(histAggs, true)    // historical months (filter non-fuel)
    addToMonth(prevAggs, true)    // previous month (filter non-fuel)
    addToMonth(convAggs, false)   // current period (already filtered)
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

    // ── Stock items — calculado ANTES do catálogo pra incluir saldo em cada
    // CatalogProduct (necessário pro badge de cobertura no ProductCatalog). ──
    const estoqueMap = new Map<number, number>()
    for (const e of estoque) {
      estoqueMap.set(e.produtoCodigo, (estoqueMap.get(e.produtoCodigo) ?? 0) + e.saldo)
    }

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
          saldo: estoqueMap.get(code),
        }
      })
      .sort((a, b) => b.faturamento - a.faturamento)

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

    // ── Projeção de vendas ──
    // Extrapola o faturamento do mês corrente pelos dias que faltam (média
    // móvel suavizada). Em mês fechado não há dias restantes → projetado =
    // realizado. Compara com o faturamento do mês anterior.
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    let diasRestantes = 0
    if (dataInicial <= todayISO && todayISO <= dataFinal) {
      const end = new Date(`${dataFinal}T00:00:00`)
      const t = new Date(`${todayISO}T00:00:00`)
      diasRestantes = Math.max(0, Math.round((end.getTime() - t.getTime()) / 86400000))
    }
    const projetadoFat = smoothedProjection({
      realizado: totalFat,
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.faturamento })),
      diasRestantes,
      today: todayISO,
    }).projetado
    // Lucro bruto projetado — mesma técnica, série diária de margemRs (LB absoluto)
    const totalLucro = dailyData.reduce((s, d) => s + d.margemRs, 0)
    const projetadoLucro = smoothedProjection({
      realizado: totalLucro,
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.margemRs })),
      diasRestantes,
      today: todayISO,
    }).projetado
    const projecao: ProjecaoVendas = {
      faturamento: projetadoFat,
      lucroBruto: projetadoLucro,
      comparativo: prevFat,
      variacao: prevFat > 0 ? ((projetadoFat - prevFat) / prevFat) * 100 : 0,
      isProjetada: diasRestantes > 0,
    }

    // ── Série diária do gráfico (real + projeção dos dias futuros) ──
    const fatRate = movingAverageDailyRate(
      dailyData.map((d) => ({ data: d.data, value: d.faturamento })),
      todayISO,
    )
    const dailyByDate = new Map(dailyData.map((d) => [d.data, d]))
    const dailyChartData: DailyChartRow[] = []
    {
      const s = new Date(`${dataInicial}T00:00:00`)
      const e = new Date(`${dataFinal}T00:00:00`)
      for (const cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        const isFuture = ds > todayISO
        const row = dailyByDate.get(ds)
        dailyChartData.push({
          data: ds,
          faturamento: isFuture ? null : (row?.faturamento ?? 0),
          projetado: isFuture ? fatRate : null,
          margemRs: isFuture ? null : (row?.margemRs ?? 0),
        })
      }
    }

    return {
      kpis,
      projecao,
      dailyData,
      dailyChartData,
      salesByDay,
      productsByGroup,
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
  }, [
    vendaItensData, prevMonthData, evolutionData, produtosData, gruposData, estoqueRaw, empresaCodigo,
    dataInicial, dataFinal,
    vendasCacheCurrent.isCacheHit, vendasCacheCurrent.vendas,
    vendasCachePrev.isCacheHit, vendasCachePrev.vendas,
    vendasCacheEvo.isCacheHit, vendasCacheEvo.vendas,
  ])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
    // "Instantâneo": vendas vieram do snapshot mensal (apuracao_vendas).
    isCacheHit: vendasCacheCurrent.isCacheHit,
  }
}

export default useConvenienceData
