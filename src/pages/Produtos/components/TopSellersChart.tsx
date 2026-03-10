import { Trophy } from 'lucide-react'
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
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { TopSellerRow } from '@/pages/Produtos/hooks/useProductData'

interface TopSellersChartProps {
  data: TopSellerRow[]
}

const podiumStyles = [
  'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700',
  'bg-gray-50 border-gray-300 dark:bg-gray-800/50 dark:border-gray-600',
  'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700',
]

const podiumLabels = ['1o Lugar', '2o Lugar', '3o Lugar']

const TopSellersChart = ({ data }: TopSellersChartProps) => (
  <div className="space-y-4">
    {/* Podium top 3 */}
    {data.length >= 3 && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {data.slice(0, 3).map((item, i) => (
          <div key={item.produtoCodigo} className={cn('rounded-xl border-2 p-5 shadow-sm', podiumStyles[i])}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {podiumLabels[i]}
              </span>
              {i === 0 && <Trophy className="h-5 w-5 text-amber-500" />}
            </div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{item.nome}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Quantidade</p>
                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(item.quantidade)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Faturamento</p>
                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(item.faturamento)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Lucro bruto</p>
                <p className={cn(
                  'text-sm font-semibold tabular-nums',
                  item.lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {formatCurrency(item.lucroBruto)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Chart + ranking */}
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
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                      : idx === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  )}>
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
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-500' : 'bg-blue-500'
                        )}
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
  </div>
)

export default TopSellersChart
