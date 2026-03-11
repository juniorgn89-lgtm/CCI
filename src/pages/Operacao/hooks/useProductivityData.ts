import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchPlacares, fetchFuncionarios } from '@/api/endpoints/funcionarios'

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
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  const {
    data: placaresData,
    isLoading: isLoadingPlacares,
  } = useQuery({
    queryKey: ['placares', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchPlacares({
      empresaCodigo: empresaCodigo ?? undefined,
      dataInicial,
      dataFinal,
    }),
    enabled: hasEmpresa,
  })

  const {
    data: funcionariosData,
    isLoading: isLoadingFuncionarios,
  } = useQuery({
    queryKey: ['funcionarios', empresaCodigo],
    queryFn: () => fetchFuncionarios({
      empresaCodigo: empresaCodigo ?? undefined,
      ativo: true,
    }),
    enabled: hasEmpresa,
  })

  const isLoading = hasEmpresa && (isLoadingPlacares || isLoadingFuncionarios)

  const computed = useMemo(() => {
    const placares = placaresData?.resultados ?? []
    const funcionarios = funcionariosData?.resultados ?? []

    const nomeMap = new Map(funcionarios.map((f) => [f.funcionarioCodigo, f.nome]))

    const ranking: RankingRow[] = placares.map((p) => ({
      funcionarioCodigo: p.funcionarioCodigo,
      funcionarioNome: nomeMap.get(p.funcionarioCodigo) ?? `Funcionário ${p.funcionarioCodigo}`,
      totalVendas: p.totalVendas,
      quantidadeVendas: p.quantidadeVendas,
      ticketMedio: p.ticketMedio,
      taxaConversao: p.taxaConversao,
    }))

    const salesRanking = [...ranking].sort((a, b) => b.totalVendas - a.totalVendas)
    const conversionRanking = [...ranking].sort((a, b) => b.taxaConversao - a.taxaConversao)
    const ticketRanking = [...ranking].sort((a, b) => b.ticketMedio - a.ticketMedio)

    const champion = salesRanking.length > 0 ? salesRanking[0] : null

    // Compute summary KPIs
    const totalVendas = ranking.reduce((sum, r) => sum + r.totalVendas, 0)
    const totalQuantidade = ranking.reduce((sum, r) => sum + r.quantidadeVendas, 0)
    const avgTicket = totalQuantidade > 0 ? totalVendas / totalQuantidade : 0
    const avgConversao = ranking.length > 0
      ? ranking.reduce((sum, r) => sum + r.taxaConversao, 0) / ranking.length
      : 0

    const kpis = {
      totalVendedores: ranking.length,
      totalVendas,
      totalQuantidade,
      avgTicket,
      avgConversao,
    }

    return { champion, salesRanking, conversionRanking, ticketRanking, kpis }
  }, [placaresData, funcionariosData])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
  }
}

export default useProductivityData
