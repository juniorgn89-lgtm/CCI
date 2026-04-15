import { FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    : isPositive
      ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400'
      : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown
  const text = isNeutral ? 'estável' : `${isPositive ? '+' : ''}${value.toFixed(1)}%`

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${bgColor}`}>
      <Icon className="h-3 w-3" />
      <span>{text}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  )
}

const DashboardSummary = ({ globalKpi, comparison }: DashboardSummaryProps) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const period = formatPeriod(dataInicial, dataFinal)

  const fatVsPrevMonth = pctChange(globalKpi.faturamento, comparison.prevMonth.faturamento)
  const fatVsPrevYear = pctChange(globalKpi.faturamento, comparison.prevYear.faturamento)
  const lbVsPrevMonth = pctChange(globalKpi.lucroBruto, comparison.prevMonth.lucroBruto)
  const lbVsPrevYear = pctChange(globalKpi.lucroBruto, comparison.prevYear.lucroBruto)

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-[#1e3a5f]/5 to-white p-5 shadow-sm dark:border-gray-700 dark:from-[#1e3a5f]/20 dark:to-gray-900">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resumo — {period}</p>
      </div>

      {/* Números globais */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-blue-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-blue-950/20 dark:to-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Faturamento</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(globalKpi.faturamento)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <ChangeTag value={fatVsPrevMonth} label={`vs ${prevMonthLabel(dataInicial)}`} />
            <ChangeTag value={fatVsPrevYear} label={`vs ${prevYearLabel(dataInicial)}`} />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-emerald-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-emerald-950/20 dark:to-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Lucro bruto</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(globalKpi.lucroBruto)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChangeTag value={lbVsPrevMonth} label={`vs ${prevMonthLabel(dataInicial)}`} />
            <ChangeTag value={lbVsPrevYear} label={`vs ${prevYearLabel(dataInicial)}`} />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-purple-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-purple-950/20 dark:to-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Margem geral</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatPercent(globalKpi.margem)}</p>
          {comparison.prevMonth.faturamento > 0 && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Mês ant.: {formatCurrency(comparison.prevMonth.faturamento)}
            </p>
          )}
        </div>
      </div>

    </div>
  )
}

export default DashboardSummary
