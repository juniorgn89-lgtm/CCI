import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { CHART_COLORS } from '@/lib/constants'
import type { ChartPoint } from '@/pages/Estoques/hooks/useStockData'

interface StockMovementChartProps {
  data: ChartPoint[]
}

const formatDate = (date: string) => {
  // Handles "MM-yyyy" (e.g. "03-2026") or "yyyy-MM-dd"
  const parts = date.split('-')
  if (parts.length === 2) return `${parts[0]}/${parts[1]}`
  if (parts.length >= 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}`
  return date
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label ? formatDate(label) : ''}
      </p>
      <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">
        {payload[0].value.toLocaleString('pt-BR')} un.
      </p>
    </div>
  )
}

const StockMovementChart = ({ data }: StockMovementChartProps) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <BarChart3 className="h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
          Sem dados de movimentação no período
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Movimentação de Estoque
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="quantidade"
            name="Quantidade"
            fill={CHART_COLORS[1]}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default StockMovementChart
