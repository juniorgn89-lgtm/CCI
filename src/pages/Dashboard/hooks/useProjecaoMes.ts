import { useMemo } from 'react'
import useDashboardData from './useDashboardData'
import { useFilterStore, type ComparisonMode } from '@/store/filters'
import { linearProjection } from '@/lib/projection'

export interface ProjecaoValues {
  faturamento: number
  lucroBruto: number
  margem: number
}

export interface ProjecaoVariacao {
  faturamento: number
  lucroBruto: number
}

export interface AlertaMenorMargem {
  empresaCodigo: number
  empresa: string
  margem: number
  litros: number
  lucroBruto: number
}

export interface ProjecaoMesData {
  realizado: ProjecaoValues
  projetado: ProjecaoValues
  /**
   * Variação realizada vs benchmark escolhido (mês anterior ou ano anterior).
   * O `comparisonMode` indica contra qual período a variação foi calculada,
   * pra que a UI mostre o label certo ("vs mês anterior" / "vs ano anterior").
   */
  variacao: ProjecaoVariacao
  comparisonMode: ComparisonMode
  diasFechados: number
  diasNoMes: number
  alertaMenorMargem: AlertaMenorMargem | null
  awaitingFirstClose: boolean
  isLoading: boolean
}

const formatDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const useProjecaoMes = (): ProjecaoMesData => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  const yesterday = new Date(year, month, today.getDate() - 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  const diasFechados = today.getDate() - 1
  const diasNoMes = lastOfMonth.getDate()
  const awaitingFirstClose = diasFechados <= 0

  const dataInicial = formatDate(firstOfMonth)
  // Quando aguardando primeiro fechamento, range é inválido (D1 > D-1).
  // Usa firstOfMonth como dataFinal para manter range válido — o flag awaitingFirstClose ignora os dados retornados.
  const dataFinal = awaitingFirstClose ? dataInicial : formatDate(yesterday)
  const todayISO = formatDate(today)
  // A query cobre só 1º→ontem (dias fechados), então hoje + futuro ainda não
  // entraram no realizado e são os dias a projetar.
  const diasRestantes = diasNoMes - diasFechados

  const { globalKpi, sectorDetails, comparison, salesEvolution, isLoading } = useDashboardData({
    period: { dataInicial, dataFinal },
  })

  const comparisonMode = useFilterStore((s) => s.comparisonMode)

  return useMemo<ProjecaoMesData>(() => {
    if (awaitingFirstClose) {
      return {
        realizado: { faturamento: 0, lucroBruto: 0, margem: 0 },
        projetado: { faturamento: 0, lucroBruto: 0, margem: 0 },
        variacao: { faturamento: 0, lucroBruto: 0 },
        comparisonMode,
        diasFechados: 0,
        diasNoMes,
        alertaMenorMargem: null,
        awaitingFirstClose: true,
        isLoading,
      }
    }

    const realizado: ProjecaoValues = {
      faturamento: globalKpi?.faturamento ?? 0,
      lucroBruto: globalKpi?.lucroBruto ?? 0,
      margem: globalKpi?.margem ?? 0,
    }

    // Ritmo via média móvel dos últimos 7 dias fechados (faturamento total
    // por dia = combustível + não-combustível).
    const dailyFat = salesEvolution.map((p) => ({
      data: p.date,
      value: p.fuelRevenue + p.nonFuelRevenue,
    }))
    const { projetado: projetadoFat } = linearProjection({
      realizado: realizado.faturamento,
      dailySeries: dailyFat,
      diasRestantes,
      today: todayISO,
    })
    // Não temos lucro diário pra suavizar, então o lucro cresce proporcional
    // ao faturamento — mantém a margem realizada (mesmo comportamento de antes).
    const growth = realizado.faturamento > 0 ? projetadoFat / realizado.faturamento : 1
    const projetadoLB = realizado.lucroBruto * growth
    const projetado: ProjecaoValues = {
      faturamento: projetadoFat,
      lucroBruto: projetadoLB,
      margem: projetadoFat > 0 ? (projetadoLB / projetadoFat) * 100 : 0,
    }

    // Benchmark conforme escolha do usuário: prevMonth ou prevYear.
    // Ambos já vêm prontos do useDashboardData (queries paralelas com cache).
    const benchmark =
      comparisonMode === 'prevMonth'
        ? comparison?.prevMonth
        : comparison?.prevYear
    const benchFat = benchmark?.faturamento ?? 0
    const benchLB = benchmark?.lucroBruto ?? 0
    const variacao: ProjecaoVariacao = {
      faturamento:
        benchFat > 0 ? ((realizado.faturamento - benchFat) / benchFat) * 100 : 0,
      lucroBruto:
        benchLB > 0 ? ((realizado.lucroBruto - benchLB) / benchLB) * 100 : 0,
    }

    const fuelEmpresas = sectorDetails?.combustivel.empresas ?? []
    const empresasComVenda = fuelEmpresas.filter((e) => e.litros > 0)
    const piorMargem =
      empresasComVenda.length > 0
        ? empresasComVenda.reduce((min, cur) => (cur.margem < min.margem ? cur : min))
        : null

    const alertaMenorMargem: AlertaMenorMargem | null = piorMargem
      ? {
          empresaCodigo: piorMargem.empresaCodigo,
          empresa: piorMargem.empresa,
          margem: piorMargem.margem,
          litros: piorMargem.litros,
          lucroBruto: piorMargem.lucroBruto,
        }
      : null

    return {
      realizado,
      projetado,
      variacao,
      comparisonMode,
      diasFechados,
      diasNoMes,
      alertaMenorMargem,
      awaitingFirstClose: false,
      isLoading,
    }
  }, [
    globalKpi,
    sectorDetails,
    comparison,
    comparisonMode,
    salesEvolution,
    todayISO,
    diasRestantes,
    diasFechados,
    diasNoMes,
    awaitingFirstClose,
    isLoading,
  ])
}

export default useProjecaoMes
