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
import { formatDate, formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import { COLORS } from '@/lib/constants'

interface CashFlowRow {
  data: string
  entradas: number
  saidas: number
  saldo: number
}

interface CashFlowChartProps {
  data: CashFlowRow[]
}

const CashFlowChart = ({ data }: CashFlowChartProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Fluxo de Caixa</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="data"
            tickFormatter={(v: string) => formatDate(v)}
            tick={{ fontSize: 12 }}
          />
          <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCurrencyTooltip(value),
              name,
            ]}
            labelFormatter={(label: string) => formatDate(label)}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="entradas"
            name="Entradas"
            stroke={COLORS.positive}
            fill={COLORS.positive}
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="saidas"
            name="Saídas"
            stroke={COLORS.negative}
            fill={COLORS.negative}
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CashFlowChart
