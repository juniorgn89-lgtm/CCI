import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchGrupos } from '@/api/endpoints/produtos'
import { formatCurrency, formatNumber } from '@/lib/formatters'

export interface DailyRow {
  data: string
  faturamento: number
  custo: number
  margemRs: number
  margemPct: number
  qtdItens: number
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

const useConvenienceData = () => {
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
    queryKey: ['vendaItens', empresaCodigo, dataInicial, dataFinal],
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
    const totalMargemRs = vendaItens.reduce((acc, item) => acc + (item.totalVenda - item.totalCusto), 0)
    const totalQuantidade = vendaItens.reduce((acc, item) => acc + item.quantidade, 0)
    const ticketMedio = vendaItens.length > 0 ? totalFaturamento / vendaItens.length : 0

    const kpis = {
      faturamento: { value: formatCurrency(totalFaturamento) },
      margem: { value: formatCurrency(totalMargemRs) },
      qtdItens: { value: formatNumber(totalQuantidade) },
      ticketMedio: { value: formatCurrency(ticketMedio) },
    }

    // --- Group by day ---
    const byDay = new Map<string, { faturamento: number; custo: number; qtdItens: number }>()
    for (const item of vendaItens) {
      const day = item.dataMovimento.split('T')[0]
      const prev = byDay.get(day) ?? { faturamento: 0, custo: 0, qtdItens: 0 }
      byDay.set(day, {
        faturamento: prev.faturamento + item.totalVenda,
        custo: prev.custo + item.totalCusto,
        qtdItens: prev.qtdItens + item.quantidade,
      })
    }

    const dailyData: DailyRow[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, values]) => {
        const margemRs = values.faturamento - values.custo
        const margemPct = values.faturamento > 0 ? (margemRs / values.faturamento) * 100 : 0
        return {
          data,
          faturamento: values.faturamento,
          custo: values.custo,
          margemRs,
          margemPct,
          qtdItens: values.qtdItens,
        }
      })

    // --- Group by product (as proxy for grupo) ---
    const byProduct = new Map<number, { faturamento: number; quantidade: number; custo: number }>()
    for (const item of vendaItens) {
      const prev = byProduct.get(item.produtoCodigo) ?? { faturamento: 0, quantidade: 0, custo: 0 }
      byProduct.set(item.produtoCodigo, {
        faturamento: prev.faturamento + item.totalVenda,
        quantidade: prev.quantidade + item.quantidade,
        custo: prev.custo + item.totalCusto,
      })
    }

    const groupTable: GroupRow[] = Array.from(byProduct.entries())
      .map(([produtoCodigo, values]) => {
        const margemTotal = values.faturamento - values.custo
        const margemPct = values.faturamento > 0 ? (margemTotal / values.faturamento) * 100 : 0
        return {
          grupoCodigo: produtoCodigo,
          nome: grupoMap.get(produtoCodigo) ?? `Produto ${produtoCodigo}`,
          faturamento: values.faturamento,
          quantidade: values.quantidade,
          margemTotal,
          margemPct,
        }
      })
      .sort((a, b) => b.faturamento - a.faturamento)

    // --- Monthly evolution ---
    const byMonth = new Map<string, { faturamento: number; custo: number }>()
    for (const item of vendaItens) {
      const month = item.dataMovimento.substring(0, 7)
      const prev = byMonth.get(month) ?? { faturamento: 0, custo: 0 }
      byMonth.set(month, {
        faturamento: prev.faturamento + item.totalVenda,
        custo: prev.custo + item.totalCusto,
      })
    }

    const revenueData: RevenueRow[] = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, values]) => ({
        mes,
        faturamento: values.faturamento,
        margem: values.faturamento - values.custo,
      }))

    return { kpis, dailyData, groupTable, revenueData }
  }, [vendaItensData, gruposData])

  return {
    ...computed,
    isLoading,
  }
}

export default useConvenienceData
