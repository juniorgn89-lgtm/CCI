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
import type { ProductRow } from '@/pages/Produtos/hooks/useProductData'

interface ParetoChartProps {
  data: ProductRow[]
}

const ParetoChart = ({ data }: ParetoChartProps) => {
  const sorted = [...data].sort((a, b) => b.faturamento - a.faturamento).slice(0, 20)
  const totalFat = data.reduce((s, r) => s + r.faturamento, 0)

  let acumulado = 0
  const chartData = sorted.map((p) => {
    acumulado += p.faturamento
    return {
      nome: p.nome.length > 18 ? p.nome.slice(0, 18) + '…' : p.nome,
      faturamento: p.faturamento,
      acumuladoPct: totalFat > 0 ? (acumulado / totalFat) * 100 : 0,
    }
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Pareto de produtos</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Top 20 produtos por faturamento com % acumulado</p>
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">
          Sem dados para o período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis
              dataKey="nome"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              angle={-35}
              textAnchor="end"
              height={70}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="faturamento"
              orientation="left"
              tickFormatter={formatCurrencyShort}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="acumulado"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={((value: number, name: string) =>
                name === 'Faturamento'
                  ? [formatCurrencyTooltip(value), name]
                  : [`${value.toFixed(1)}%`, name]
              ) as never}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
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
              dot={{ r: 3, fill: CHART_COLORS[0] }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default ParetoChart
