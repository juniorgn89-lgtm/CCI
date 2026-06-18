import { Trophy } from 'lucide-react'
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
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { TopSellerItem } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface TopSellersProps {
  topSellers: TopSellerItem[]
  treemapData: { name: string; value: number; quantidade: number }[]
}

const podiumStyles = [
  'bg-white border-amber-400 dark:bg-gray-900 dark:border-amber-500',
  'bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-500',
  'bg-white border-orange-400 dark:bg-gray-900 dark:border-orange-500',
]
const podiumLabels = ['1º Lugar', '2º Lugar', '3º Lugar']

const DONUT_COLORS = [
  '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
]

const TopSellers = ({ topSellers, treemapData }: TopSellersProps) => {
  const totalFat = treemapData.reduce((s, d) => s + d.value, 0)

  return (
  <div className="space-y-4">
    {/* Podium top 3 */}
    {topSellers.length >= 3 && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {topSellers.slice(0, 3).map((item, i) => (
          <div key={item.produtoCodigo} className={cn('rounded-xl border-2 p-5 shadow-sm', podiumStyles[i])}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {podiumLabels[i]}
              </span>
              {i === 0 && <Trophy className="h-5 w-5 text-amber-500" />}
            </div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{item.nome}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.grupo}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Quantidade</p>
                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(item.quantidade)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Faturamento</p>
                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(item.faturamento)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Lucro</p>
                <p className={cn(
                  'text-sm font-semibold tabular-nums',
                  item.lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {formatCurrency(item.lucroBruto)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Participação</p>
                <p className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">{item.participacaoPct.toFixed(2)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Bar chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Top 10 Mais Vendidos</h3>
        {topSellers.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topSellers} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number, name: string) => [
                  name === 'Faturamento' ? formatCurrencyTooltip(v) : formatNumber(v),
                  name,
                ]) as never}
              />
              <Bar dataKey="faturamento" name="Faturamento" fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Donut chart + legend */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Participação por Grupo</h3>
        {treemapData.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="w-[200px] shrink-0">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={treemapData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {treemapData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={((v: number) => [formatCurrencyTooltip(v), 'Faturamento']) as never}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend list */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-3" style={{ maxHeight: 280 }}>
              {treemapData.map((item, i) => {
                const pct = totalFat > 0 ? (item.value / totalFat) * 100 : 0
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {pct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                        {formatCurrency(item.value)} &middot; {formatNumber(item.quantidade)} itens
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Full ranking list */}
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking Completo</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {topSellers.map((item, idx) => {
          const maxQtd = topSellers[0]?.quantidade ?? 1
          const pct = (item.quantidade / maxQtd) * 100
          return (
            <div key={item.produtoCodigo} className="flex items-center gap-3 px-6 py-3">
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
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.nome}</span>
                    <span className="ml-2 text-xs text-gray-400">{item.grupo}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm tabular-nums">
                    <span className="text-gray-500 dark:text-gray-400">{formatNumber(item.quantidade)} un</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(item.faturamento)}</span>
                  </div>
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
  </div>
  )
}

export default TopSellers
