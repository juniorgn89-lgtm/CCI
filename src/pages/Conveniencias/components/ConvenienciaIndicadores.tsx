import { useMemo } from 'react'
import {
  Package, Trophy,
} from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import type { DailyChartRow, GroupRow, TopSellerItem } from '@/pages/Conveniencias/hooks/useConvenienceData'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

interface Props {
  dailyChartData: DailyChartRow[]
  groupTable: GroupRow[]
  topSellers: TopSellerItem[]
  onNavigateTab: (tab: string) => void
}

const fmtDay = (d: string) => {
  const parts = d.split('-')
  return `${parts[2]}/${parts[1]}`
}

const ConvenienciaIndicadores = ({ dailyChartData, groupTable, topSellers, onNavigateTab }: Props) => {
  const computed = useMemo(() => {
    // Top 5 groups for donut
    const topGroups = groupTable.slice(0, 6)
    // Top 5 sellers
    const top5 = topSellers.slice(0, 5)
    return { topGroups, top5 }
  }, [topSellers, groupTable])

  return (
    <div className="space-y-6">
      {/* Daily sales chart — moved from Vendas tab */}
      {dailyChartData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">Vendas Diárias</h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis dataKey="data" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number, name: string) => [formatCurrencyTooltip(v), name]) as never}
                labelFormatter={fmtDay as never}
              />
              <Legend />
              {/* Barras reais (dias fechados) + projeção (dias futuros, tracejado).
                  stackId mantém a largura cheia já que só um valor existe por dia. */}
              <Bar dataKey="faturamento" name="Faturamento" stackId="fat" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="projetado" name="Projeção" stackId="fat" fill={CHART_COLORS[1]} fillOpacity={0.25} stroke={CHART_COLORS[1]} strokeOpacity={0.5} strokeDasharray="3 3" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="margemRs" name="Margem" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Vendas por grupo (donut) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Package className="mr-1.5 inline h-4 w-4 text-violet-500" />
              Vendas por Grupo
            </h3>
            <button onClick={() => onNavigateTab('vendas')} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">Ver detalhes</button>
          </div>
          {computed.topGroups.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-[160px] shrink-0">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={computed.topGroups} dataKey="faturamento" nameKey="nome" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                      {computed.topGroups.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      formatter={((v: number) => [formatCurrencyTooltip(v), 'Faturamento']) as never}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {computed.topGroups.map((g, i) => {
                  const total = computed.topGroups.reduce((s, x) => s + x.faturamento, 0)
                  const pct = total > 0 ? (g.faturamento / total) * 100 : 0
                  return (
                    <div key={g.grupoCodigo} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{g.nome}</span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct.toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] tabular-nums text-gray-400">{formatCurrency(g.faturamento)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top produtos */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Trophy className="mr-1.5 inline h-4 w-4 text-amber-500" />
              Top 5 Produtos
            </h3>
            <button onClick={() => onNavigateTab('topVendidos')} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">Ver ranking</button>
          </div>
          {computed.top5.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div className="space-y-2">
              {computed.top5.map((p, i) => {
                const maxQtd = computed.top5[0]?.quantidade || 1
                const pct = (p.quantidade / maxQtd) * 100
                return (
                  <div key={p.produtoCodigo} className="flex items-center gap-3">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      i === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                      i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm text-gray-900 dark:text-gray-100">{p.nome}</span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(p.quantidade)} un.</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">{formatCurrency(p.faturamento)} &middot; {p.participacaoPct.toFixed(1)}% do total</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConvenienciaIndicadores
