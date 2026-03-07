import { FileText, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import type { SectorKpi, PeriodComparison } from '@/pages/Dashboard/hooks/useDashboardData'

interface DashboardSummaryProps {
  sectorKpis: SectorKpi[]
  globalKpi: SectorKpi
  comparison: PeriodComparison
}

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const formatPeriod = (dataInicial: string, dataFinal: string) => {
  const [y1, m1, d1] = dataInicial.split('-')
  const [y2, m2, d2] = dataFinal.split('-')
  if (m1 === m2 && y1 === y2 && d1 === '01') {
    return `${monthNames[Number(m1) - 1]} de ${y1}`
  }
  return `${d1}/${m1}/${y1} a ${d2}/${m2}/${y2}`
}

const prevMonthLabel = (dataInicial: string) => {
  const d = new Date(dataInicial)
  d.setMonth(d.getMonth() - 1)
  return `${monthNames[d.getMonth()]}/${d.getFullYear()}`
}

const prevYearLabel = (dataInicial: string) => {
  const d = new Date(dataInicial)
  return `${monthNames[d.getMonth()]}/${d.getFullYear() - 1}`
}

const pctChange = (current: number, previous: number): number | null => {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

const ChangeTag = ({ value, label }: { value: number | null; label: string }) => {
  if (value === null) return null
  const isPositive = value > 0
  const isNeutral = Math.abs(value) < 0.5

  const bgColor = isNeutral
    ? 'bg-gray-100 text-gray-600'
    : isPositive
      ? 'bg-green-50 text-green-700'
      : 'bg-red-50 text-red-700'

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown
  const text = isNeutral ? 'estável' : `${isPositive ? '+' : ''}${value.toFixed(1)}%`

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${bgColor}`}>
      <Icon className="h-3 w-3" />
      <span>{text}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  )
}

const DashboardSummary = ({ sectorKpis, globalKpi, comparison }: DashboardSummaryProps) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const period = formatPeriod(dataInicial, dataFinal)

  const fuel = sectorKpis.find((k) => k.label === 'Combustível')
  const auto = sectorKpis.find((k) => k.label === 'Automotivos')
  const conv = sectorKpis.find((k) => k.label === 'Conveniência')

  const sectors = [fuel, auto, conv].filter(Boolean) as SectorKpi[]
  const bestMargin = sectors.length > 0
    ? sectors.reduce((a, b) => (a.margem > b.margem ? a : b))
    : null

  const h = (text: string) => <span className="text-gray-900">{text}</span>

  const fatVsPrevMonth = pctChange(globalKpi.faturamento, comparison.prevMonth.faturamento)
  const fatVsPrevYear = pctChange(globalKpi.faturamento, comparison.prevYear.faturamento)

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-[#1e3a5f]/5 to-white p-5 shadow-sm">
      {/* Título */}
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#1e3a5f]" />
        <p className="text-sm font-semibold text-gray-900">Resumo — {period}</p>
      </div>

      {/* Visão geral + comparativo */}
      <div className="mb-3 text-sm leading-relaxed text-gray-600">
        O faturamento total da rede foi de {h(formatCurrency(globalKpi.faturamento))}, gerando {h(formatCurrency(globalKpi.lucroBruto))} de
        lucro bruto com margem geral de {h(formatPercent(globalKpi.margem))}.
      </div>

      {/* Tags de comparativo */}
      <div className="mb-4 flex flex-wrap gap-2">
        <ChangeTag value={fatVsPrevMonth} label={`vs ${prevMonthLabel(dataInicial)}`} />
        <ChangeTag value={fatVsPrevYear} label={`vs ${prevYearLabel(dataInicial)}`} />
        {comparison.prevMonth.faturamento > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] text-gray-400">
            Mês anterior: {formatCurrency(comparison.prevMonth.faturamento)}
          </span>
        )}
      </div>

      {/* Desempenho por setor */}
      <div className="border-t border-gray-200 pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Desempenho por setor</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {sectors.map((sector) => (
            <div key={sector.label} className="flex items-center gap-2 text-sm text-gray-600">
              <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-300" />
              <span>{h(sector.label)}: {formatCurrency(sector.lucroBruto)} de lucro</span>
              <span className="text-xs text-gray-400">({formatPercent(sector.margem)})</span>
            </div>
          ))}
        </div>
        {bestMargin && (
          <p className="mt-2 text-xs text-gray-500">
            Destaque: {h(bestMargin.label)} com a melhor margem do período ({h(formatPercent(bestMargin.margem))}).
            {fuel?.lbPorLitro !== undefined && (
              <> Combustíveis com lucro de {h(formatCurrency(fuel.lbPorLitro))} por litro.</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export default DashboardSummary
