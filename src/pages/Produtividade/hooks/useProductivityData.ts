import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutividadeFuncionario } from '@/api/endpoints/relatorios'
import type { ProdutividadeFuncionario } from '@/api/types/funcionario'

export interface RankingRow {
  funcionarioCodigo: number
  funcionarioNome: string
  totalVendas: number
  quantidadeVendas: number
  ticketMedio: number
  taxaConversao: number
  [key: string]: unknown
}

const useProductivityData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  const {
    data: produtividade,
    isLoading,
  } = useQuery({
    queryKey: ['produtividadeFuncionario', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchProdutividadeFuncionario({
      empresaCodigo: empresaCodigo ?? undefined,
      dataInicial,
      dataFinal,
    }),
  })

  const computed = useMemo(() => {
    const dados: ProdutividadeFuncionario[] = produtividade ?? []

    const ranking: RankingRow[] = dados.map((d) => ({
      funcionarioCodigo: d.funcionarioCodigo,
      funcionarioNome: d.funcionarioNome,
      totalVendas: d.totalVendas,
      quantidadeVendas: d.quantidadeVendas,
      ticketMedio: d.ticketMedio,
      taxaConversao: d.taxaConversao,
    }))

    const salesRanking = [...ranking].sort((a, b) => b.totalVendas - a.totalVendas)
    const conversionRanking = [...ranking].sort((a, b) => b.taxaConversao - a.taxaConversao)
    const ticketRanking = [...ranking].sort((a, b) => b.ticketMedio - a.ticketMedio)

    const champion = salesRanking.length > 0 ? salesRanking[0] : null

    return { champion, salesRanking, conversionRanking, ticketRanking }
  }, [produtividade])

  return {
    ...computed,
    isLoading,
  }
}

export default useProductivityData
