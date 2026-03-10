import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useMemo } from 'react'
import type { Setor } from '@/pages/Dashboard/hooks/useDashboardData'

export interface NonFuelProduct {
  produtoCodigo: number
  nome: string
  quantidade: number
  faturamento: number
  lucroBruto: number
  margem: number
  precoMedio: number
  custoMedio: number
  ticketMedio: number
}

export interface NonFuelGrupo {
  grupoCodigo: number
  nome: string
  quantidade: number
  faturamento: number
  lucroBruto: number
  margem: number
  produtos: NonFuelProduct[]
}

// Classify grupo tipoGrupo to our sector
const classifyGrupo = (tipoGrupo: string, nome?: string): Setor => {
  const t = tipoGrupo.toUpperCase().trim().replace(/\.$/, '')
  const n = (nome ?? '').toUpperCase().trim().replace(/\.$/, '')
  // Loja / Conveniência
  if (t === 'L' || t === 'LOJA' || t === 'LJ' || t === 'CONVENIENCIA' || t === 'CONVENIÊNCIA'
    || n.includes('CONVENIENCIA') || n.includes('CONVENIÊNCIA') || n.includes('LOJA')) {
    return 'conveniencia'
  }
  // Combustível
  if (t === 'C' || t.startsWith('COMBUSTI')
    || n.startsWith('COMBUSTI')) {
    return 'combustivel'
  }
  // Everything else → automotivos (P, PRODUTO, AUTOMOTIVO, SERVICO, etc.)
  return 'automotivos'
}

const useNonFuelDrilldown = (empresaCodigo: number, setor: Setor, enabled: boolean) => {
  const { dataInicial, dataFinal } = useFilterStore()

  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['vendaItensNonFuel', empresaCodigo, dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) =>
          fetchVendaItens({
            empresaCodigo,
            usaProdutoLmc: false,
            dataInicial,
            dataFinal,
            ultimoCodigo: p.ultimoCodigo,
            limite: p.limite,
          }),
        1000,
        20
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000,
        100
      ),
    staleTime: 30 * 60 * 1000,
  })

  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000,
        100
      ),
    staleTime: 30 * 60 * 1000,
  })

  const grupos = useMemo((): NonFuelGrupo[] => {
    if (!items.length) return []

    const productNameMap = new Map<number, string>()
    const productGrupoMap = new Map<number, number>()
    for (const p of produtosData ?? []) {
      productNameMap.set(p.produtoCodigo, p.nome)
      productGrupoMap.set(p.produtoCodigo, p.grupoCodigo)
    }

    // Build grupo info maps
    const grupoNameMap = new Map<number, string>()
    const grupoSetorMap = new Map<number, Setor>()
    for (const g of gruposData ?? []) {
      grupoNameMap.set(g.grupoCodigo, g.nome)
      grupoSetorMap.set(g.grupoCodigo, classifyGrupo(g.tipoGrupo, g.nome))
    }

    // Aggregate by product
    const prodAgg = new Map<number, { qty: number; fat: number; custo: number }>()
    for (const item of items) {
      const prev = prodAgg.get(item.produtoCodigo) ?? { qty: 0, fat: 0, custo: 0 }
      prodAgg.set(item.produtoCodigo, {
        qty: prev.qty + item.quantidade,
        fat: prev.fat + item.totalVenda,
        custo: prev.custo + item.totalCusto,
      })
    }

    // Group products by grupoCodigo, filtering by setor
    const grupoAgg = new Map<number, { produtos: NonFuelProduct[]; qty: number; fat: number; custo: number }>()

    for (const [prodCode, data] of prodAgg.entries()) {
      const grupoCodigo = productGrupoMap.get(prodCode) ?? -1
      const grupoSetor = grupoSetorMap.get(grupoCodigo) ?? 'automotivos'

      // Only include groups that belong to the requested setor
      if (grupoSetor !== setor) continue

      const lb = data.fat - data.custo

      const product: NonFuelProduct = {
        produtoCodigo: prodCode,
        nome: productNameMap.get(prodCode) ?? `Produto ${prodCode}`,
        quantidade: data.qty,
        faturamento: data.fat,
        lucroBruto: lb,
        margem: data.fat > 0 ? (lb / data.fat) * 100 : 0,
        precoMedio: data.qty > 0 ? data.fat / data.qty : 0,
        custoMedio: data.qty > 0 ? data.custo / data.qty : 0,
        ticketMedio: data.qty > 0 ? data.fat / data.qty : 0,
      }

      const prev = grupoAgg.get(grupoCodigo) ?? { produtos: [], qty: 0, fat: 0, custo: 0 }
      prev.produtos.push(product)
      prev.qty += data.qty
      prev.fat += data.fat
      prev.custo += data.custo
      grupoAgg.set(grupoCodigo, prev)
    }

    const result: NonFuelGrupo[] = []
    for (const [grupoCodigo, data] of grupoAgg.entries()) {
      const lb = data.fat - data.custo
      result.push({
        grupoCodigo,
        nome: grupoCodigo < 0 ? 'Sem grupo' : (grupoNameMap.get(grupoCodigo) ?? `Grupo ${grupoCodigo}`),
        quantidade: data.qty,
        faturamento: data.fat,
        lucroBruto: lb,
        margem: data.fat > 0 ? (lb / data.fat) * 100 : 0,
        produtos: data.produtos.sort((a, b) => b.faturamento - a.faturamento),
      })
    }

    return result.sort((a, b) => b.faturamento - a.faturamento)
  }, [items, produtosData, gruposData, setor])

  return { grupos, isLoading: isLoadingItems }
}

export default useNonFuelDrilldown
