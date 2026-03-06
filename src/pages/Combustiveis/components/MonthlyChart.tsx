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
import { formatCurrencyShort, formatLitersShort, formatCurrencyTooltip } from '@/lib/formatters'

interface MonthlyRow {
  mes: string
  litros: number
  faturamento: number
}

interface MonthlyChartProps {
  data: MonthlyRow[]
}

const formatMonth = (mes: string) => {
  const [year, month] = mes.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[Number(month) - 1]}/${year.slice(2)}`
}

const MonthlyChart = ({ data }: MonthlyChartProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Evolução Mensal</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="mes" tickFormatter={formatMonth} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="litros" orientation="left" tickFormatter={formatLitersShort} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="faturamento" orientation="right" tickFormatter={formatCurrencyShort} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === 'Litros'
                ? [value.toLocaleString('pt-BR') + ' L', name]
                : [formatCurrencyTooltip(value), name]
            }
            labelFormatter={formatMonth}
          />
          <Legend />
          <Area
            yAxisId="litros"
            type="monotone"
            dataKey="litros"
            name="Litros"
            stroke={CHART_COLORS[0]}
            fill={CHART_COLORS[0]}
            fillOpacity={0.15}
          />
          <Area
            yAxisId="faturamento"
            type="monotone"
            dataKey="faturamento"
            name="Faturamento"
            stroke={CHART_COLORS[1]}
            fill={CHART_COLORS[1]}
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default MonthlyChart
