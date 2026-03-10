import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { BarChart3, PieChart as PieIcon } from 'lucide-react'
import { formatNumber } from '@/lib/formatters'
import type { CategoryStock, StatusBreakdown } from '@/pages/Estoques/hooks/useStockData'

interface StockMovementChartProps {
  categoryStock: CategoryStock[]
  statusBreakdown: StatusBreakdown[]
}

const CATEGORY_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#06b6d4',
  '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f59e0b',
  '#f97316', '#ef4444', '#ec4899', '#d946ef', '#64748b',
]

const CategoryTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryStock }> }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{d.categoria}</p>
      <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">
        {formatNumber(d.saldo)} un.
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{formatNumber(d.produtos)} produtos</p>
    </div>
  )
}

const StatusTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: StatusBreakdown; value: number }> }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs font-medium" style={{ color: d.color }}>{d.label}</p>
      <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">
        {formatNumber(d.count)} produtos
      </p>
    </div>
  )
}

const StockMovementChart = ({ categoryStock, statusBreakdown }: StockMovementChartProps) => {
  const totalProdutos = statusBreakdown.reduce((a, b) => a + b.count, 0)

  if (categoryStock.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <BarChart3 className="h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
          Sem dados de estoque disponíveis
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {/* Category distribution - horizontal bar chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 xl:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Estoque por Categoria
          </h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Top {categoryStock.length}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(250, categoryStock.length * 36)}>
          <BarChart data={categoryStock} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <YAxis
              type="category"
              dataKey="categoria"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip content={<CategoryTooltip />} />
            <Bar dataKey="saldo" name="Saldo" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {categoryStock.map((_, idx) => (
                <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status breakdown - pie + legend */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Status do Estoque
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={statusBreakdown.filter((s) => s.count > 0)}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="count"
              nameKey="label"
              strokeWidth={2}
              stroke="transparent"
            >
              {statusBreakdown.filter((s) => s.count > 0).map((entry) => (
                <Cell key={entry.status} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<StatusTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 space-y-2">
          {statusBreakdown.map((s) => (
            <div key={s.status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatNumber(s.count)}
                </span>
                <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                  {totalProdutos > 0 ? ((s.count / totalProdutos) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default StockMovementChart
