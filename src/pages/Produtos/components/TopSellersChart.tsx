import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrencyShort, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import type { TopSellerRow } from '@/pages/Produtos/hooks/useProductData'

interface TopSellersChartProps {
  data: TopSellerRow[]
}

const TopSellersChart = ({ data }: TopSellersChartProps) => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="mb-6">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Top 10 mais vendidos</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">Produtos com maior quantidade vendida no período</p>
    </div>
    {data.length === 0 ? (
      <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">
        Sem dados para o período selecionado.
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis
              type="number"
              tickFormatter={formatCurrencyShort}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="nome"
              width={140}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={((value: number, name: string) => [
                name === 'Faturamento' ? formatCurrencyTooltip(value) : formatNumber(value),
                name,
              ]) as never}
            />
            <Bar dataKey="faturamento" name="Faturamento" fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Ranking list */}
        <div className="space-y-2">
          {data.map((item, idx) => {
            const maxQtd = data[0]?.quantidade ?? 1
            const pct = (item.quantidade / maxQtd) * 100
            return (
              <div key={item.produtoCodigo} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.nome}</span>
                    <span className="ml-2 shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatNumber(item.quantidade)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}
  </div>
)

export default TopSellersChart
