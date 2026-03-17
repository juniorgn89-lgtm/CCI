import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutoEstoque, fetchEstoquePeriodo } from '@/api/endpoints/estoques'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { ProdutoEstoque, EstoquePeriodo } from '@/api/types/estoque'
import type { Produto } from '@/api/types/produto'

// --- Exported row types ---

export interface StockRow {
  produtoCodigo: number
  produtoNome: string
  categoria: string
  grupoCodigo: number
  codigoSku: string
  local: string
  estoqueCodigo: number
  saldo: number
  status: 'negativo' | 'sem_estoque' | 'critico' | 'baixo' | 'normal'
}

export interface MovementRow {
  dataMovimento: string
  codigoProduto: number
  produtoNome: string
  quantidade: number
}

export interface ChartPoint {
  date: string
  quantidade: number
}

export interface CategoryStock {
  categoria: string
  saldo: number
  produtos: number
}

export interface StatusBreakdown {
  status: StockRow['status']
  label: string
  count: number
  color: string
}

export interface AlertItem {
  produtoCodigo: number
  produtoNome: string
  categoria: string
  saldo: number
  local: string
  severity: 'negative' | 'danger' | 'warning' | 'caution'
}

export interface StockKpiData {
  totalProdutos: number
  saldoTotal: number
  produtosBaixoEstoque: number
  produtosSemEstoque: number
}

// --- Thresholds ---
const THRESHOLD_ZERO = 0
const THRESHOLD_CRITICAL = 5
const THRESHOLD_LOW = 20

const getStatus = (saldo: number): StockRow['status'] => {
  if (saldo < THRESHOLD_ZERO) return 'negativo'
  if (saldo === THRESHOLD_ZERO) return 'sem_estoque'
  if (saldo <= THRESHOLD_CRITICAL) return 'critico'
  if (saldo <= THRESHOLD_LOW) return 'baixo'
  return 'normal'
}

const getSeverity = (saldo: number): AlertItem['severity'] => {
  if (saldo < THRESHOLD_ZERO) return 'negative'
  if (saldo === THRESHOLD_ZERO) return 'danger'
  if (saldo <= THRESHOLD_CRITICAL) return 'warning'
  return 'caution'
}

const useStockData = () => {
  const { empresaCodigos, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  // Reference data — uses same query keys as prefetch so it shares cache
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

  const {
    data: produtoEstoqueData,
    isLoading: isLoadingProdutoEstoque,
  } = useQuery({
    queryKey: ['produtoEstoque', empresaCodigo],
    queryFn: () => fetchProdutoEstoque({
      empresaCodigo: empresaCodigo!,
    }),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  const {
    data: estoquePeriodoData,
    isLoading: isLoadingPeriodo,
  } = useQuery({
    queryKey: ['estoquePeriodo', empresaCodigo, dataFinal],
    queryFn: () => fetchEstoquePeriodo({
      dataFinal,
      empresaCodigo: empresaCodigo ?? undefined,
    }),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  const isLoading = isLoadingProdutoEstoque || isLoadingPeriodo

  const computed = useMemo(() => {
    const raw: ProdutoEstoque[] = produtoEstoqueData?.resultados ?? []
    const periodos: EstoquePeriodo[] = estoquePeriodoData?.resultados ?? []

    // --- Stock Table rows ---
    const stockTable: StockRow[] = raw.flatMap((pe) => {
      const prod = produtoMap.get(pe.produtoCodigo)
      const produtoNome = prod?.nome ?? `Produto ${pe.produtoCodigo}`
      const grupoCodigo = prod?.grupoCodigo ?? 0
      const categoria = grupoMap.get(grupoCodigo) ?? 'Outros'
      const codigoSku = prod?.referenciaCodigo || prod?.produtoCodigoExterno || String(pe.produtoCodigo)

      if (pe.saldoEstoque && pe.saldoEstoque.length > 0) {
        return pe.saldoEstoque.map((se) => ({
          produtoCodigo: pe.produtoCodigo,
          produtoNome,
          categoria,
          grupoCodigo,
          codigoSku,
          local: se.estoqueNome,
          estoqueCodigo: se.estoqueCodigo,
          saldo: se.quantidade,
          status: getStatus(se.quantidade),
        }))
      }

      return [{
        produtoCodigo: pe.produtoCodigo,
        produtoNome,
        categoria,
        grupoCodigo,
        codigoSku,
        local: '-',
        estoqueCodigo: pe.estoqueCodigo,
        saldo: pe.saldo,
        status: getStatus(pe.saldo),
      }]
    })

    // --- KPIs (aggregate by product) ---
    const byProduct = new Map<number, number>()
    for (const row of stockTable) {
      byProduct.set(row.produtoCodigo, (byProduct.get(row.produtoCodigo) ?? 0) + row.saldo)
    }

    const totalProdutos = byProduct.size
    const saldoTotal = Array.from(byProduct.values()).reduce((a, b) => a + b, 0)
    const produtosSemEstoque = Array.from(byProduct.values()).filter((s) => s <= THRESHOLD_ZERO).length
    const produtosBaixoEstoque = Array.from(byProduct.values()).filter((s) => s > THRESHOLD_ZERO && s <= THRESHOLD_LOW).length

    const kpis: StockKpiData = {
      totalProdutos,
      saldoTotal,
      produtosBaixoEstoque,
      produtosSemEstoque,
    }

    // --- Alerts (products in critical state) ---
    const alerts: AlertItem[] = stockTable
      .filter((r) => r.status !== 'normal')
      .map((r) => ({
        produtoCodigo: r.produtoCodigo,
        produtoNome: r.produtoNome,
        categoria: r.categoria,
        saldo: r.saldo,
        local: r.local,
        severity: getSeverity(r.saldo),
      }))
      .sort((a, b) => {
        const order = { negative: 0, danger: 1, warning: 2, caution: 3 }
        return order[a.severity] - order[b.severity] || a.saldo - b.saldo
      })

    // --- Movement chart (group by period) ---
    const movementByDate = new Map<string, number>()
    for (const ep of periodos) {
      const period = ep.dataMovimento.includes('T') ? ep.dataMovimento.split('T')[0] : ep.dataMovimento
      movementByDate.set(period, (movementByDate.get(period) ?? 0) + ep.quatidadeEstoque)
    }

    const movementChart: ChartPoint[] = Array.from(movementByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, qty]) => ({ date, quantidade: qty }))

    // --- Distribution by category ---
    const catMap = new Map<string, { saldo: number; produtos: Set<number> }>()
    for (const row of stockTable) {
      const entry = catMap.get(row.categoria)
      if (entry) {
        entry.saldo += row.saldo
        entry.produtos.add(row.produtoCodigo)
      } else {
        catMap.set(row.categoria, { saldo: row.saldo, produtos: new Set([row.produtoCodigo]) })
      }
    }
    const categoryStock: CategoryStock[] = Array.from(catMap.entries())
      .map(([categoria, v]) => ({ categoria, saldo: v.saldo, produtos: v.produtos.size }))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 15)

    // --- Status breakdown ---
    const statusCount = { negativo: 0, sem_estoque: 0, critico: 0, baixo: 0, normal: 0 }
    for (const [, saldo] of byProduct) {
      statusCount[getStatus(saldo)]++
    }
    const statusBreakdown: StatusBreakdown[] = [
      { status: 'normal', label: 'Normal', count: statusCount.normal, color: '#22c55e' },
      { status: 'baixo', label: 'Baixo', count: statusCount.baixo, color: '#f59e0b' },
      { status: 'critico', label: 'Crítico', count: statusCount.critico, color: '#f97316' },
      { status: 'sem_estoque', label: 'Sem Estoque', count: statusCount.sem_estoque, color: '#ef4444' },
      { status: 'negativo', label: 'Negativo', count: statusCount.negativo, color: '#991b1b' },
    ]

    // --- Movement detail rows ---
    const movementHistory: MovementRow[] = periodos
      .map((ep) => ({
        dataMovimento: ep.dataMovimento,
        codigoProduto: ep.codigoProduto,
        produtoNome: produtoMap.get(ep.codigoProduto)?.nome ?? `Produto ${ep.codigoProduto}`,
        quantidade: ep.quatidadeEstoque,
      }))
      .sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento))

    // --- Unique categories for filters ---
    const categorias = Array.from(new Set(stockTable.map((r) => r.categoria))).sort()

    return { kpis, stockTable, alerts, movementChart, movementHistory, categorias, categoryStock, statusBreakdown }
  }, [produtoEstoqueData, estoquePeriodoData, produtoMap, grupoMap])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
  }
}

export default useStockData
