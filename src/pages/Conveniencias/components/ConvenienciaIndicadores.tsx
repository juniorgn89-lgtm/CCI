import { useMemo } from 'react'
import {
  DollarSign, TrendingUp, Package, Receipt, ArrowUpRight, ArrowDownRight,
  Lightbulb, Trophy, AlertTriangle, ShoppingCart, Clock,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import type { ConvKpiData, GroupRow, TopSellerItem, InsightItem, RevenueRow } from '@/pages/Conveniencias/hooks/useConvenienceData'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

interface Props {
  kpis: ConvKpiData
  groupTable: GroupRow[]
  topSellers: TopSellerItem[]
  revenueData: RevenueRow[]
  insights: InsightItem[]
  onNavigateTab: (tab: string) => void
}

const ConvenienciaIndicadores = ({ kpis, groupTable, topSellers, revenueData, insights, onNavigateTab }: Props) => {
  const fatChange = kpis.prev.faturamento > 0
    ? ((kpis.faturamento - kpis.prev.faturamento) / kpis.prev.faturamento) * 100
    : undefined

  const margemChange = kpis.prev.margem > 0
    ? ((kpis.margem - kpis.prev.margem) / kpis.prev.margem) * 100
    : undefined

  const qtdChange = kpis.prev.qtdItens > 0
    ? ((kpis.qtdItens - kpis.prev.qtdItens) / kpis.prev.qtdItens) * 100
    : undefined

  const kpiCards = [
    { label: 'Faturamento', value: formatCurrency(kpis.faturamento), change: fatChange, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', tab: 'vendas' },
    { label: 'Margem Bruta', value: formatCurrency(kpis.margem), change: margemChange, subtitle: `${kpis.margemPct.toFixed(1)}%`, icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', iconBg: 'bg-blue-100 dark:bg-blue-900/30', tab: 'performance' },
    { label: 'Itens Vendidos', value: formatNumber(kpis.qtdItens), change: qtdChange, subtitle: `${kpis.totalProdutos} produtos`, icon: Package, color: 'text-violet-600 dark:text-violet-400', cardBg: 'bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900', iconBg: 'bg-violet-100 dark:bg-violet-900/30', tab: 'topVendidos' },
    { label: 'Ticket Médio', value: formatCurrency(kpis.ticketMedio), icon: Receipt, color: 'text-amber-600 dark:text-amber-400', cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', iconBg: 'bg-amber-100 dark:bg-amber-900/30', tab: 'vendas' },
  ]

  const computed = useMemo(() => {
    // Auto insights
    const autoInsights: { type: 'positive' | 'warning' | 'info'; text: string }[] = []

    if (fatChange !== undefined) {
      autoInsights.push({
        type: fatChange >= 0 ? 'positive' : 'warning',
        text: `Faturamento ${fatChange >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(fatChange).toFixed(1)}% vs mês anterior`,
      })
    }

    if (kpis.margemPct >= 30) {
      autoInsights.push({ type: 'positive', text: `Margem saudável de ${kpis.margemPct.toFixed(1)}%` })
    } else if (kpis.margemPct < 20 && kpis.margemPct > 0) {
      autoInsights.push({ type: 'warning', text: `Margem baixa: ${kpis.margemPct.toFixed(1)}%. Revise precificação.` })
    }

    if (topSellers.length > 0) {
      autoInsights.push({
        type: 'info',
        text: `${topSellers[0].nome} lidera com ${formatNumber(topSellers[0].quantidade)} unidades vendidas`,
      })
    }

    const topGrupo = groupTable[0]
    if (topGrupo) {
      autoInsights.push({
        type: 'info',
        text: `Grupo "${topGrupo.nome}" concentra ${formatCurrency(topGrupo.faturamento)} em vendas`,
      })
    }

    // Add existing insights from hook
    for (const ins of insights.slice(0, 2)) {
      autoInsights.push({
        type: ins.type,
        text: `${ins.title}: ${ins.description}`,
      })
    }

    const order = { positive: 0, info: 1, warning: 2 }
    autoInsights.sort((a, b) => order[a.type] - order[b.type])

    // Top 5 groups for donut
    const topGroups = groupTable.slice(0, 6)

    // Top 5 sellers
    const top5 = topSellers.slice(0, 5)

    return { autoInsights, topGroups, top5 }
  }, [kpis, fatChange, topSellers, groupTable, insights])

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          const isPositive = card.change !== undefined && card.change >= 0
          return (
            <button
              key={card.label}
              onClick={() => onNavigateTab(card.tab)}
              className={cn('rounded-lg border border-gray-200/60 px-3 py-2.5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700/60', card.cardBg)}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', card.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', card.color)} />
                </div>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
              <div className="mt-1 flex items-center gap-2">
                {'subtitle' in card && card.subtitle && (
                  <p className="text-xs text-gray-400">{card.subtitle}</p>
                )}
                {card.change !== undefined && (
                  <span className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    isPositive ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                  )}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(card.change).toFixed(1)}% vs mês anterior
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Insights */}
      {computed.autoInsights.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Insights da Conveniência</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {computed.autoInsights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2',
                  ins.type === 'positive' && 'border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10',
                  ins.type === 'warning' && 'border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10',
                  ins.type === 'info' && 'border-blue-200 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-900/10',
                )}
              >
                {ins.type === 'positive' && <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />}
                {ins.type === 'warning' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                {ins.type === 'info' && <ShoppingCart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
                <p className="text-xs text-gray-700 dark:text-gray-300">{ins.text}</p>
              </div>
            ))}
          </div>
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

      {/* Evolução mensal */}
      {revenueData.length > 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Clock className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Evolução Mensal
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number, name: string) => [formatCurrencyTooltip(v), name === 'faturamento' ? 'Faturamento' : 'Margem']) as never}
              />
              <Bar dataKey="faturamento" name="Faturamento" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="margem" name="Margem" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default ConvenienciaIndicadores
