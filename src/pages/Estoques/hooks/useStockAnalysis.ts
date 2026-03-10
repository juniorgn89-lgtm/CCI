import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutoEstoque, fetchEstoquePeriodo } from '@/api/endpoints/estoques'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Produto } from '@/api/types/produto'

export interface StockAnalysisRow {
  produtoCodigo: number
  produtoNome: string
  grupoCodigo: number
  categoria: string
  estoque: number
  mediaMes: number
  necessidade: number
  giro: number
  estoqueMedio: number
}

const MONTHS_LOOKBACK = 6

const computeDateRange = () => {
  const today = new Date()
  const sixMonthsAgo = new Date(today)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - MONTHS_LOOKBACK)

  const format = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return { dataInicial6m: format(sixMonthsAgo), dataFinal6m: format(today) }
}

const useStockAnalysis = () => {
  const { empresaCodigos, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const { dataInicial6m, dataFinal6m } = useMemo(() => computeDateRange(), [])

  // Reuse cached reference data (same query keys as useStockData)
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Current stock positions (all pages)
  const { data: produtoEstoqueData, isLoading: isLoadingEstoque } = useQuery({
    queryKey: ['produtoEstoqueAll', empresaCodigo],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutoEstoque({ empresaCodigo: empresaCodigo!, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20
    ),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Stock period data (all pages)
  const { data: estoquePeriodoData, isLoading: isLoadingPeriodo } = useQuery({
    queryKey: ['estoquePeriodoAll', empresaCodigo, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchEstoquePeriodo({
        dataFinal,
        empresaCodigo: empresaCodigo ?? undefined,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20
    ),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Sales items for last 6 months — limit to 20 pages (20K items) for performance
  const { data: vendaItensData, isLoading: isLoadingVendas } = useQuery({
    queryKey: ['vendaItens6m', empresaCodigo, dataInicial6m, dataFinal6m],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo!,
        dataInicial: dataInicial6m,
        dataFinal: dataFinal6m,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20
    ),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const isLoading = isLoadingEstoque || isLoadingPeriodo || isLoadingVendas

  const produtoMap = useMemo(() => {
    const map = new Map<number, Produto>()
    for (const p of produtosData ?? []) map.set(p.produtoCodigo, p)
    return map
  }, [produtosData])

  const grupoMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const g of gruposData ?? []) map.set(g.grupoCodigo, g.nome)
    return map
  }, [gruposData])

  const { rows, categorias } = useMemo(() => {
    const estoqueItems = produtoEstoqueData ?? []
    const periodos = estoquePeriodoData ?? []
    const vendaItens = vendaItensData ?? []

    // Build sales map: produtoCodigo -> total quantity sold in 6 months
    const salesMap = new Map<number, number>()
    for (const item of vendaItens) {
      salesMap.set(item.produtoCodigo, (salesMap.get(item.produtoCodigo) ?? 0) + item.quantidade)
    }

    // Build average stock map from period data
    // Group by product, then average the quantities
    const stockPeriodMap = new Map<number, number[]>()
    for (const ep of periodos) {
      const existing = stockPeriodMap.get(ep.codigoProduto)
      if (existing) {
        existing.push(ep.quatidadeEstoque)
      } else {
        stockPeriodMap.set(ep.codigoProduto, [ep.quatidadeEstoque])
      }
    }

    const avgStockMap = new Map<number, number>()
    for (const [code, quantities] of stockPeriodMap) {
      const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length
      avgStockMap.set(code, avg)
    }

    // Aggregate current stock by product (sum across locations)
    const currentStockMap = new Map<number, number>()
    for (const pe of estoqueItems) {
      if (pe.saldoEstoque && pe.saldoEstoque.length > 0) {
        const total = pe.saldoEstoque.reduce((sum, se) => sum + se.quantidade, 0)
        currentStockMap.set(pe.produtoCodigo, (currentStockMap.get(pe.produtoCodigo) ?? 0) + total)
      } else {
        currentStockMap.set(pe.produtoCodigo, (currentStockMap.get(pe.produtoCodigo) ?? 0) + pe.saldo)
      }
    }

    // Build analysis rows
    const analysisRows: StockAnalysisRow[] = []
    const categorySet = new Set<string>()

    for (const [produtoCodigo, estoque] of currentStockMap) {
      const prod = produtoMap.get(produtoCodigo)

      // Skip fuel products — managed in the Combustíveis module
      if (prod?.combustivel) continue

      const produtoNome = prod?.nome ?? `Produto ${produtoCodigo}`
      const grupoCodigo = prod?.grupoCodigo ?? 0
      const categoria = grupoMap.get(grupoCodigo) ?? 'Outros'

      const totalSales = salesMap.get(produtoCodigo) ?? 0
      const mediaMes = totalSales / MONTHS_LOOKBACK
      const necessidade = mediaMes - estoque
      const estoqueMedio = avgStockMap.get(produtoCodigo) ?? 0
      const giro = estoqueMedio > 0 ? totalSales / estoqueMedio : 0

      categorySet.add(categoria)

      analysisRows.push({
        produtoCodigo,
        produtoNome,
        grupoCodigo,
        categoria,
        estoque,
        mediaMes,
        necessidade,
        giro,
        estoqueMedio,
      })
    }

    return {
      rows: analysisRows,
      categorias: Array.from(categorySet).sort(),
    }
  }, [produtoEstoqueData, estoquePeriodoData, vendaItensData, produtoMap, grupoMap])

  return {
    rows,
    categorias,
    isLoading,
    hasEmpresa,
  }
}

export default useStockAnalysis
