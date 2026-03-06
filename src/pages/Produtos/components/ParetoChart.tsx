import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import type { ParetoRow } from '@/pages/Produtos/hooks/useProductData'

interface ParetoChartProps {
  data: ParetoRow[]
}

const ParetoChart = ({ data }: ParetoChartProps) => {
  const displayData = data.slice(0, 20)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Pareto de Produtos</h3>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={displayData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="nome"
            tick={{ fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            yAxisId="faturamento"
            orientation="left"
            tickFormatter={formatCurrencyShort}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="acumulado"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === 'Faturamento'
                ? [formatCurrencyTooltip(value), name]
                : [`${value.toFixed(1)}%`, name]
            }
          />
          <Legend />
          <Bar
            yAxisId="faturamento"
            dataKey="faturamento"
            name="Faturamento"
            fill={CHART_COLORS[1]}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="acumulado"
            type="monotone"
            dataKey="acumuladoPct"
            name="% Acumulado"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ParetoChart
