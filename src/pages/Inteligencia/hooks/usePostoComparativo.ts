import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { todayLocal } from '@/lib/period'

export interface PeriodMetrics {
  label: string
  receita: number
  litros: number
  abastecimentos: number
  ticketMedio: number
}

export interface ComparativoData {
  postoNome: string
  atual: PeriodMetrics
  mesAnterior: PeriodMetrics
  anoAnterior: PeriodMetrics
  variacaoMes: {
    receita: number
    litros: number
    abastecimentos: number
    ticketMedio: number
  }
  variacaoAno: {
    receita: number
    litros: number
    abastecimentos: number
    ticketMedio: number
  }
}

const offsetPeriod = (dateStr: string, months: number) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1 - months, d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const calcVariacao = (atual: number, anterior: number) =>
  anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0

const usePostoComparativo = (empresaCodigo: number | null) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const enabled = !!empresaCodigo

  // "Mesmos dias decorridos" (igual ao BI): corta o fim em hoje antes de deslocar.
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const prevMonthInicial = offsetPeriod(dataInicial, 1)
  const prevMonthFinal = offsetPeriod(fimEfetivo, 1)
  const prevYearInicial = offsetPeriod(dataInicial, 12)
  const prevYearFinal = offsetPeriod(fimEfetivo, 12)

  // Empresa name
  const { data: empresasRaw } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 30 * 60 * 1000,
  })

  // Current period
  const { data: resumoAtual } = useQuery({
    queryKey: ['vendaResumoComparativo', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchVendaResumo({ empresaCodigo: [empresaCodigo!], dataInicial, dataFinal }),
    enabled,
  })

  const { data: abastAtual } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled,
  })

  // Previous month
  const { data: resumoPrevMonth } = useQuery({
    queryKey: ['vendaResumoComparativo', empresaCodigo, prevMonthInicial, prevMonthFinal],
    queryFn: () => fetchVendaResumo({ empresaCodigo: [empresaCodigo!], dataInicial: prevMonthInicial, dataFinal: prevMonthFinal }),
    enabled,
  })

  const { data: abastPrevMonth } = useQuery({
    queryKey: ['abastecimentos', prevMonthInicial, prevMonthFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prevMonthInicial, dataFinal: prevMonthFinal }),
    enabled,
  })

  // Previous year
  const { data: resumoPrevYear } = useQuery({
    queryKey: ['vendaResumoComparativo', empresaCodigo, prevYearInicial, prevYearFinal],
    queryFn: () => fetchVendaResumo({ empresaCodigo: [empresaCodigo!], dataInicial: prevYearInicial, dataFinal: prevYearFinal }),
    enabled,
  })

  const { data: abastPrevYear } = useQuery({
    queryKey: ['abastecimentos', prevYearInicial, prevYearFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prevYearInicial, dataFinal: prevYearFinal }),
    enabled,
  })

  const isLoading = !resumoAtual || !abastAtual

  const comparativo = useMemo((): ComparativoData | null => {
    if (!empresaCodigo || !resumoAtual || !abastAtual) return null

    const empresas = empresasRaw?.resultados ?? []
    const empresa = empresas.find((e) => e.codigo === empresaCodigo || e.empresaCodigo === empresaCodigo)
    const postoNome = empresa?.fantasia ?? `Posto ${empresaCodigo}`

    const filterAbast = (data: typeof abastAtual, cod: number) =>
      (data ?? []).filter((a) => a.empresaCodigo === cod)

    const buildMetrics = (label: string, resumo: typeof resumoAtual, abast: typeof abastAtual): PeriodMetrics => {
      const receita = (resumo ?? []).reduce((s, r) => s + r.total, 0)
      const filtered = filterAbast(abast, empresaCodigo)
      const litros = filtered.reduce((s, a) => s + a.quantidade, 0)
      const abastecimentos = filtered.length
      const ticketMedio = abastecimentos > 0 ? receita / abastecimentos : 0
      return { label, receita, litros, abastecimentos, ticketMedio }
    }

    const [y1, m1] = dataInicial.split('-')
    const [y2, m2] = prevMonthInicial.split('-')
    const [y3] = prevYearInicial.split('-')

    const atual = buildMetrics(`${m1}/${y1}`, resumoAtual, abastAtual)
    const mesAnterior = buildMetrics(`${m2}/${y2}`, resumoPrevMonth ?? [], abastPrevMonth ?? [])
    const anoAnterior = buildMetrics(`${m1}/${y3}`, resumoPrevYear ?? [], abastPrevYear ?? [])

    return {
      postoNome,
      atual,
      mesAnterior,
      anoAnterior,
      variacaoMes: {
        receita: calcVariacao(atual.receita, mesAnterior.receita),
        litros: calcVariacao(atual.litros, mesAnterior.litros),
        abastecimentos: calcVariacao(atual.abastecimentos, mesAnterior.abastecimentos),
        ticketMedio: calcVariacao(atual.ticketMedio, mesAnterior.ticketMedio),
      },
      variacaoAno: {
        receita: calcVariacao(atual.receita, anoAnterior.receita),
        litros: calcVariacao(atual.litros, anoAnterior.litros),
        abastecimentos: calcVariacao(atual.abastecimentos, anoAnterior.abastecimentos),
        ticketMedio: calcVariacao(atual.ticketMedio, anoAnterior.ticketMedio),
      },
    }
  }, [empresaCodigo, resumoAtual, abastAtual, resumoPrevMonth, abastPrevMonth, resumoPrevYear, abastPrevYear, empresasRaw, dataInicial, prevMonthInicial, prevYearInicial])

  return { comparativo, isLoading }
}

export default usePostoComparativo
