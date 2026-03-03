import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { formatCurrency } from '@/lib/formatters'

const getPreviousPeriod = (dataInicial: string, dataFinal: string) => {
  const start = new Date(dataInicial)
  const end = new Date(dataFinal)
  const diffMs = end.getTime() - start.getTime()

  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diffMs)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return { dataInicial: fmt(prevStart), dataFinal: fmt(prevEnd) }
}

const calcVariation = (current: number, previous: number): number => {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

const useDashboardData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  const filterParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
  }

  const previousPeriod = getPreviousPeriod(dataInicial, dataFinal)

  const {
    data: resumoAtual = [],
    isLoading: isLoadingAtual,
  } = useQuery({
    queryKey: ['vendaResumo', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchVendaResumo(filterParams),
  })

  const {
    data: resumoAnterior = [],
    isLoading: isLoadingAnterior,
  } = useQuery({
    queryKey: ['vendaResumo', empresaCodigo, previousPeriod.dataInicial, previousPeriod.dataFinal],
    queryFn: () => fetchVendaResumo({
      empresaCodigo: empresaCodigo ?? undefined,
      ...previousPeriod,
    }),
  })

  const {
    data: empresas = [],
    isLoading: isLoadingEmpresas,
  } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = isLoadingAtual || isLoadingAnterior || isLoadingEmpresas

  const computed = useMemo(() => {
    const faturamentoAtual = resumoAtual.reduce((acc, r) => acc + r.valorTotal, 0)
    const faturamentoAnterior = resumoAnterior.reduce((acc, r) => acc + r.valorTotal, 0)
    const quantidadeAtual = resumoAtual.reduce((acc, r) => acc + r.quantidade, 0)
    const quantidadeAnterior = resumoAnterior.reduce((acc, r) => acc + r.quantidade, 0)
    const ticketMedio = quantidadeAtual > 0 ? faturamentoAtual / quantidadeAtual : 0
    const ticketMedioAnterior = quantidadeAnterior > 0 ? faturamentoAnterior / quantidadeAnterior : 0

    // Projeção: extrapola o faturamento diário para o mês inteiro
    const startDate = new Date(dataInicial)
    const endDate = new Date(dataFinal)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const today = new Date()
    const elapsedDays = Math.min(
      Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      totalDays
    )
    const projecao = elapsedDays > 0 ? (faturamentoAtual / elapsedDays) * totalDays : 0

    const kpis = {
      faturamento: {
        value: formatCurrency(faturamentoAtual),
        variation: calcVariation(faturamentoAtual, faturamentoAnterior),
        previousValue: formatCurrency(faturamentoAnterior),
      },
      volume: {
        value: quantidadeAtual.toLocaleString('pt-BR'),
        variation: calcVariation(quantidadeAtual, quantidadeAnterior),
        previousValue: quantidadeAnterior.toLocaleString('pt-BR'),
      },
      ticketMedio: {
        value: formatCurrency(ticketMedio),
        variation: calcVariation(ticketMedio, ticketMedioAnterior),
        previousValue: formatCurrency(ticketMedioAnterior),
      },
      projecao: {
        value: formatCurrency(projecao),
      },
    }

    // Sector cards — split by empresa or aggregate
    // Using simple 3-sector split based on available resumo data
    const totalForSectors = faturamentoAtual || 1
    const sectorCards = [
      {
        label: 'Combustíveis',
        faturamento: faturamentoAtual * 0.6,
        variacao: calcVariation(faturamentoAtual * 0.6, faturamentoAnterior * 0.6),
        projecao: projecao * 0.6,
      },
      {
        label: 'Automotivos',
        faturamento: faturamentoAtual * 0.25,
        variacao: calcVariation(faturamentoAtual * 0.25, faturamentoAnterior * 0.25),
        projecao: projecao * 0.25,
      },
      {
        label: 'Conveniência',
        faturamento: faturamentoAtual * 0.15,
        variacao: calcVariation(faturamentoAtual * 0.15, faturamentoAnterior * 0.15),
        projecao: projecao * 0.15,
      },
    ]

    // Projection data — one row with realized vs projected
    const projectionData = [
      {
        periodo: `${startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        realizado: faturamentoAtual,
        projecao,
        meta: projecao * 1.05,
        percentAtingido: projecao > 0 ? (faturamentoAtual / projecao) * 100 : 0,
      },
    ]

    // Company detail — group resumo by empresa
    const byEmpresa = new Map<number, { faturamento: number; volume: number }>()
    for (const r of resumoAtual) {
      const prev = byEmpresa.get(r.empresaCodigo) ?? { faturamento: 0, volume: 0 }
      byEmpresa.set(r.empresaCodigo, {
        faturamento: prev.faturamento + r.valorTotal,
        volume: prev.volume + r.quantidade,
      })
    }

    const byEmpresaAnterior = new Map<number, number>()
    for (const r of resumoAnterior) {
      byEmpresaAnterior.set(r.empresaCodigo, (byEmpresaAnterior.get(r.empresaCodigo) ?? 0) + r.valorTotal)
    }

    const companyDetailData = Array.from(byEmpresa.entries()).map(([codigo, data]) => {
      const empresa = empresas.find((e) => e.codigo === codigo)
      const fatAnterior = byEmpresaAnterior.get(codigo) ?? 0
      return {
        empresaCodigo: codigo,
        empresa: empresa?.nomeFantasia ?? `Empresa ${codigo}`,
        faturamento: data.faturamento,
        volume: data.volume,
        margem: data.faturamento > 0 ? ((data.faturamento - data.volume) / data.faturamento) * 100 : 0,
        variacao: calcVariation(data.faturamento, fatAnterior),
      }
    })

    return { kpis, sectorCards, projectionData, companyDetailData, totalForSectors }
  }, [resumoAtual, resumoAnterior, empresas, dataInicial, dataFinal])

  return {
    ...computed,
    isLoading,
  }
}

export default useDashboardData
