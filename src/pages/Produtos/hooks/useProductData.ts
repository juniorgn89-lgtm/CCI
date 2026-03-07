import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

// ── Exported interfaces ────────────────────────────────────────

export interface ProductKpiData {
  totalProdutosVendidos: number
  faturamento: number
  lucroBruto: number
  margemPct: number
  ticketMedio: number
  quantidade: number
  prevMonth: {
    faturamento: number
    lucroBruto: number
    quantidade: number
  }
}

export interface ProductRow {
  produtoCodigo: number
  nome: string
  grupo: string
  grupoCodigo: number
  precoMedioVenda: number
  precoCustoMedio: number
  quantidade: number
  faturamento: number
  custo: number
  lucroBruto: number
  margemPct: number
  ticketMedio: number
  [key: string]: unknown
}

export interface TopSellerRow {
  produtoCodigo: number
  nome: string
  quantidade: number
  faturamento: number
  lucroBruto: number
}

export interface AbcRow {
  produtoCodigo: number
  nome: string
  grupo: string
  faturamento: number
  quantidade: number
  acumuladoPct: number
  classificacao: 'A' | 'B' | 'C'
  [key: string]: unknown
}

// ── Helper: previous month range ───────────────────────────────

const getPrevMonthRange = (dataInicial: string, dataFinal: string) => {
  const d = new Date(dataInicial)
  d.setMonth(d.getMonth() - 1)
  const y = d.getFullYear()
  const m = d.getMonth()
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`
  return { dataInicial: first, dataFinal: last }
}

// ── Hook ───────────────────────────────────────────────────────

const useProductData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()
  const prevMonth = getPrevMonthRange(dataInicial, dataFinal)

  const filterParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
    usaProdutoLmc: false,
  }

  // Current period venda itens
  const { data: vendaItensData, isLoading: l1 } = useQuery({
    queryKey: ['vendaItens', 'produtos', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchVendaItens(filterParams),
  })

  // Previous month venda itens (for KPI comparison)
  const { data: prevMonthData, isLoading: l2 } = useQuery({
    queryKey: ['vendaItens', 'produtos-prev', empresaCodigo, prevMonth.dataInicial, prevMonth.dataFinal],
    queryFn: () => fetchVendaItens({
      empresaCodigo: empresaCodigo ?? undefined,
      dataInicial: prevMonth.dataInicial,
      dataFinal: prevMonth.dataFinal,
      usaProdutoLmc: false,
    }),
  })

  // Products (for name mapping)
  const { data: produtosData, isLoading: l3 } = useQuery({
    queryKey: ['produtos-all'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })

  // Groups (for group name mapping)
  const { data: gruposData, isLoading: l4 } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchGrupos(),
    staleTime: 30 * 60 * 1000,
  })

  const isLoading = l1 || l2 || l3 || l4

  const computed = useMemo(() => {
    const vendaItens = vendaItensData?.resultados ?? []
    const prevItens = prevMonthData?.resultados ?? []
    const produtos = produtosData ?? []
    const grupos = gruposData?.resultados ?? []

    // ── Maps ──
    const produtoMap = new Map<number, { nome: string; grupoCodigo: number }>()
    for (const p of produtos) {
      produtoMap.set(p.produtoCodigo, { nome: p.nome, grupoCodigo: p.grupoCodigo })
    }
    const grupoMap = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))

    const getProductName = (code: number) => produtoMap.get(code)?.nome ?? `Produto ${code}`
    const getGroupName = (code: number) => {
      const gCode = produtoMap.get(code)?.grupoCodigo
      return gCode ? (grupoMap.get(gCode) ?? 'Sem grupo') : 'Sem grupo'
    }
    const getGroupCode = (code: number) => produtoMap.get(code)?.grupoCodigo ?? 0

    // ── Aggregate by product ──
    const byProduct = new Map<number, { faturamento: number; quantidade: number; custo: number; count: number }>()
    for (const item of vendaItens) {
      const prev = byProduct.get(item.produtoCodigo) ?? { faturamento: 0, quantidade: 0, custo: 0, count: 0 }
      byProduct.set(item.produtoCodigo, {
        faturamento: prev.faturamento + item.totalVenda,
        quantidade: prev.quantidade + item.quantidade,
        custo: prev.custo + item.totalCusto,
        count: prev.count + 1,
      })
    }

    // ── KPIs ──
    const totalFaturamento = vendaItens.reduce((s, i) => s + i.totalVenda, 0)
    const totalCusto = vendaItens.reduce((s, i) => s + i.totalCusto, 0)
    const totalQuantidade = vendaItens.reduce((s, i) => s + i.quantidade, 0)
    const totalLucroBruto = totalFaturamento - totalCusto
    const margemPct = totalFaturamento > 0 ? (totalLucroBruto / totalFaturamento) * 100 : 0
    const ticketMedio = vendaItens.length > 0 ? totalFaturamento / vendaItens.length : 0

    const prevFat = prevItens.reduce((s, i) => s + i.totalVenda, 0)
    const prevCusto = prevItens.reduce((s, i) => s + i.totalCusto, 0)
    const prevQtd = prevItens.reduce((s, i) => s + i.quantidade, 0)

    const kpis: ProductKpiData = {
      totalProdutosVendidos: byProduct.size,
      faturamento: totalFaturamento,
      lucroBruto: totalLucroBruto,
      margemPct,
      ticketMedio,
      quantidade: totalQuantidade,
      prevMonth: {
        faturamento: prevFat,
        lucroBruto: prevFat - prevCusto,
        quantidade: prevQtd,
      },
    }

    // ── Product table ──
    const productTable: ProductRow[] = Array.from(byProduct.entries())
      .map(([code, v]) => ({
        produtoCodigo: code,
        nome: getProductName(code),
        grupo: getGroupName(code),
        grupoCodigo: getGroupCode(code),
        precoMedioVenda: v.quantidade > 0 ? v.faturamento / v.quantidade : 0,
        precoCustoMedio: v.quantidade > 0 ? v.custo / v.quantidade : 0,
        quantidade: v.quantidade,
        faturamento: v.faturamento,
        custo: v.custo,
        lucroBruto: v.faturamento - v.custo,
        margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
        ticketMedio: v.count > 0 ? v.faturamento / v.count : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)

    // ── Top sellers (top 10 by quantity) ──
    const topSellers: TopSellerRow[] = [...productTable]
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        quantidade: p.quantidade,
        faturamento: p.faturamento,
        lucroBruto: p.lucroBruto,
      }))

    // ── ABC classification ──
    const sorted = [...productTable].sort((a, b) => b.faturamento - a.faturamento)
    let acumulado = 0
    const abcData: AbcRow[] = sorted.map((p) => {
      acumulado += p.faturamento
      const pct = totalFaturamento > 0 ? (acumulado / totalFaturamento) * 100 : 0
      const classificacao: 'A' | 'B' | 'C' = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C'
      return {
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        faturamento: p.faturamento,
        quantidade: p.quantidade,
        acumuladoPct: pct,
        classificacao,
      }
    })

    // ── Unique groups for filter ──
    const gruposList = [...new Set(productTable.map((p) => p.grupo))].sort()

    return { kpis, productTable, topSellers, abcData, gruposList }
  }, [vendaItensData, prevMonthData, produtosData, gruposData])

  return { ...computed, isLoading }
}

export default useProductData
