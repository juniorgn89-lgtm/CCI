import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import type { RevenueRow } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface RevenueChartProps {
  data: RevenueRow[]
}

const formatMonth = (mes: string) => {
  const [year, month] = mes.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[Number(month) - 1]}/${year.slice(2)}`
}

const RevenueChart = ({ data }: RevenueChartProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Evolucao de Faturamento</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="mes" tickFormatter={formatMonth} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={((value: number, name: string) => [
              formatCurrencyTooltip(value),
              name,
            ]) as never}
            labelFormatter={formatMonth as never}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="faturamento"
            name="Faturamento"
            stroke={CHART_COLORS[1]}
            fill={CHART_COLORS[1]}
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="margem"
            name="Margem"
            stroke={CHART_COLORS[0]}
            fill={CHART_COLORS[0]}
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RevenueChart
