import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchGrupos } from '@/api/endpoints/produtos'
import { formatCurrency, formatNumber } from '@/lib/formatters'

export interface GroupRow {
  grupoCodigo: number
  nome: string
  faturamento: number
  quantidade: number
  margemTotal: number
  margemPct: number
  [key: string]: unknown
}

export interface ParetoRow {
  produtoCodigo: number
  nome: string
  faturamento: number
  acumuladoPct: number
  [key: string]: unknown
}

export interface AbcRow {
  produtoCodigo: number
  nome: string
  faturamento: number
  quantidade: number
  acumuladoPct: number
  classificacao: 'A' | 'B' | 'C'
  [key: string]: unknown
}

const useProductData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  const filterParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
    usaProdutoLmc: false,
  }

  const {
    data: vendaItensData,
    isLoading: isLoadingItens,
  } = useQuery({
    queryKey: ['vendaItens', 'produtos', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchVendaItens(filterParams),
  })

  const {
    data: gruposData,
    isLoading: isLoadingGrupos,
  } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchGrupos(),
  })

  const isLoading = isLoadingItens || isLoadingGrupos

  const computed = useMemo(() => {
    const vendaItens = vendaItensData?.resultados ?? []
    const grupos = gruposData?.resultados ?? []

    const grupoMap = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))

    const totalFaturamento = vendaItens.reduce((acc, item) => acc + item.totalVenda, 0)
    const totalQuantidade = vendaItens.reduce((acc, item) => acc + item.quantidade, 0)
    const totalMargemRs = vendaItens.reduce((acc, item) => acc + (item.totalVenda - item.totalCusto), 0)
    const ticketMedio = vendaItens.length > 0 ? totalFaturamento / vendaItens.length : 0

    const kpis = {
      faturamento: { value: formatCurrency(totalFaturamento) },
      quantidade: { value: formatNumber(totalQuantidade) },
      margem: { value: formatCurrency(totalMargemRs) },
      ticketMedio: { value: formatCurrency(ticketMedio) },
    }

    // --- Group by grupo ---
    // Since VendaItem doesn't include grupoCodigo, group by produtoCodigo for Pareto/ABC
    // and aggregate all items for group table using a product-to-group mapping would need PRODUTO endpoint.
    // For now, group by produtoCodigo for all analyses.

    const byProduct = new Map<number, { faturamento: number; quantidade: number; custo: number }>()
    for (const item of vendaItens) {
      const prev = byProduct.get(item.produtoCodigo) ?? { faturamento: 0, quantidade: 0, custo: 0 }
      byProduct.set(item.produtoCodigo, {
        faturamento: prev.faturamento + item.totalVenda,
        quantidade: prev.quantidade + item.quantidade,
        custo: prev.custo + item.totalCusto,
      })
    }

    // --- Group Table (aggregate by grupo using grupoMap) ---
    // Since we don't have a direct product-to-group mapping in VendaItem,
    // we use produtoCodigo as grouping key and show product codes as names
    const productList = Array.from(byProduct.entries())
      .map(([produtoCodigo, values]) => ({
        produtoCodigo,
        faturamento: values.faturamento,
        quantidade: values.quantidade,
        custo: values.custo,
        margemTotal: values.faturamento - values.custo,
        margemPct: values.faturamento > 0
          ? ((values.faturamento - values.custo) / values.faturamento) * 100
          : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)

    const groupTable: GroupRow[] = productList.map((p) => ({
      grupoCodigo: p.produtoCodigo,
      nome: grupoMap.get(p.produtoCodigo) ?? `Produto ${p.produtoCodigo}`,
      faturamento: p.faturamento,
      quantidade: p.quantidade,
      margemTotal: p.margemTotal,
      margemPct: p.margemPct,
    }))

    // --- Pareto Chart ---
    const sortedByRevenue = [...productList].sort((a, b) => b.faturamento - a.faturamento)
    let acumulado = 0
    const paretoData: ParetoRow[] = sortedByRevenue.map((p) => {
      acumulado += p.faturamento
      return {
        produtoCodigo: p.produtoCodigo,
        nome: `Produto ${p.produtoCodigo}`,
        faturamento: p.faturamento,
        acumuladoPct: totalFaturamento > 0 ? (acumulado / totalFaturamento) * 100 : 0,
      }
    })

    // --- ABC Curve ---
    let acumuladoAbc = 0
    const abcData: AbcRow[] = sortedByRevenue.map((p) => {
      acumuladoAbc += p.faturamento
      const pct = totalFaturamento > 0 ? (acumuladoAbc / totalFaturamento) * 100 : 0
      let classificacao: 'A' | 'B' | 'C' = 'C'
      if (pct <= 80) classificacao = 'A'
      else if (pct <= 95) classificacao = 'B'

      return {
        produtoCodigo: p.produtoCodigo,
        nome: `Produto ${p.produtoCodigo}`,
        faturamento: p.faturamento,
        quantidade: p.quantidade,
        acumuladoPct: pct,
        classificacao,
      }
    })

    return { kpis, groupTable, paretoData, abcData }
  }, [vendaItensData, gruposData])

  return {
    ...computed,
    isLoading,
  }
}

export default useProductData
