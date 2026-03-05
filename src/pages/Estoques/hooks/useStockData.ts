import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutoEstoque, fetchEstoquePeriodo } from '@/api/endpoints/estoques'
import { formatCurrency, formatNumber } from '@/lib/formatters'

export interface StockRow {
  produtoCodigo: number
  saldo: number
  estoqueCodigo: number
  estoqueNome: string
  [key: string]: unknown
}

export interface MovementRow {
  dataMovimento: string
  codigoProduto: number
  quatidadeEstoque: number
  [key: string]: unknown
}

const useStockData = () => {
  const { empresaCodigo, dataFinal } = useFilterStore()

  const {
    data: produtoEstoqueData,
    isLoading: isLoadingProdutoEstoque,
  } = useQuery({
    queryKey: ['produtoEstoque', empresaCodigo],
    queryFn: () => fetchProdutoEstoque({
      empresaCodigo: empresaCodigo ?? 0,
    }),
    enabled: !!empresaCodigo,
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
  })

  const isLoading = isLoadingProdutoEstoque || isLoadingPeriodo

  const computed = useMemo(() => {
    const produtoEstoque = produtoEstoqueData?.resultados ?? []
    const estoquePeriodo = estoquePeriodoData?.resultados ?? []

    const totalItens = produtoEstoque.length
    const totalSaldo = produtoEstoque.reduce((acc, pe) => acc + pe.saldo, 0)

    // Calculate average stock turnover from period data
    const totalEstoquePeriodo = estoquePeriodo.reduce((acc, ep) => acc + ep.quatidadeEstoque, 0)
    const giroMedio = estoquePeriodo.length > 0
      ? totalEstoquePeriodo / estoquePeriodo.length
      : 0

    const kpis = {
      totalItens: { value: formatNumber(totalItens) },
      totalSaldo: { value: formatNumber(totalSaldo) },
      giroMedio: { value: formatNumber(giroMedio) },
    }

    // --- Stock Table (flatten saldoEstoque) ---
    const stockTable: StockRow[] = produtoEstoque.flatMap((pe) =>
      pe.saldoEstoque.length > 0
        ? pe.saldoEstoque.map((se) => ({
            produtoCodigo: pe.produtoCodigo,
            saldo: se.quantidade,
            estoqueCodigo: se.estoqueCodigo,
            estoqueNome: se.estoqueNome,
          }))
        : [{
            produtoCodigo: pe.produtoCodigo,
            saldo: pe.saldo,
            estoqueCodigo: pe.estoqueCodigo,
            estoqueNome: '-',
          }]
    )

    // --- Movement chart data (group by dataMovimento) ---
    const byDate = new Map<string, number>()
    for (const ep of estoquePeriodo) {
      const day = ep.dataMovimento.split('T')[0]
      const prev = byDate.get(day) ?? 0
      byDate.set(day, prev + ep.quatidadeEstoque)
    }

    const movementData: MovementRow[] = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dataMovimento, quatidadeEstoque]) => ({
        dataMovimento,
        codigoProduto: 0,
        quatidadeEstoque,
      }))

    return { kpis, stockTable, movementData }
  }, [produtoEstoqueData, estoquePeriodoData])

  return {
    ...computed,
    isLoading,
  }
}

export default useStockData
