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
import { formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import type { SalesEvolutionPoint } from '@/pages/Dashboard/hooks/useDashboardData'

interface SalesEvolutionChartProps {
  salesEvolution: SalesEvolutionPoint[]
}

const formatDay = (date: string): string => {
  const parts = date.split('-')
  return `${parts[2]}/${parts[1]}`
}

const tooltipFormatter = (value: number, name: string): [string, string] => {
  const label = name === 'fuelRevenue' ? 'Combustivel' : 'Nao-Combustivel'
  return [formatCurrencyTooltip(value), label]
}

const tooltipLabelFormatter = (label: unknown): string => {
  const parts = String(label).split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return String(label)
}

const SalesEvolutionChart = ({ salesEvolution }: SalesEvolutionChartProps) => {
  if (salesEvolution.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-400 dark:text-gray-500">Sem dados para o periodo selecionado.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Evolucao de Vendas
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={salesEvolution}>
          <defs>
            <linearGradient id="gradFuel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradNonFuel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrencyShort(v)}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            formatter={tooltipFormatter as never}
            labelFormatter={tooltipLabelFormatter}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          <Area
            type="monotone"
            dataKey="fuelRevenue"
            name="Combustivel"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#gradFuel)"
          />
          <Area
            type="monotone"
            dataKey="nonFuelRevenue"
            name="Nao-Combustivel"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#gradNonFuel)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SalesEvolutionChart
