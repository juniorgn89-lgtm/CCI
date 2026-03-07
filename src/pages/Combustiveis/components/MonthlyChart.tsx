import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrencyShort, formatLitersShort, formatCurrencyTooltip } from '@/lib/formatters'
import type { DailyRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface EvolutionChartProps {
  data: DailyRow[]
}

const formatDay = (date: string) => {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

const EvolutionChart = ({ data }: EvolutionChartProps) => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="mb-6">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Evolução do período</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">Faturamento e litros vendidos por dia</p>
    </div>
    {data.length === 0 ? (
      <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">
        Sem dados para o período selecionado.
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
          <XAxis
            dataKey="data"
            tickFormatter={formatDay}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval={data.length > 15 ? Math.floor(data.length / 10) : 0}
          />
          <YAxis
            yAxisId="litros"
            orientation="left"
            tickFormatter={formatLitersShort}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="faturamento"
            orientation="right"
            tickFormatter={formatCurrencyShort}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            formatter={((value: number, name: string) =>
              name === 'Litros'
                ? [value.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' L', name]
                : [formatCurrencyTooltip(value), name]
            ) as never}
            labelFormatter={((label: string) => {
              const [y, m, d] = label.split('-')
              return `${d}/${m}/${y}`
            }) as never}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="litros"
            dataKey="litros"
            name="Litros"
            fill={CHART_COLORS[0]}
            fillOpacity={0.7}
            radius={[4, 4, 0, 0]}
          />
          <Area
            yAxisId="faturamento"
            type="monotone"
            dataKey="faturamento"
            name="Faturamento"
            stroke={CHART_COLORS[1]}
            fill="url(#gradFat)"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    )}
  </div>
)

export default EvolutionChart
