import { useMemo } from 'react'
import {
  Package, DollarSign, TrendingUp, BarChart3, ShoppingCart,
  Trophy, AlertTriangle, Lightbulb, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatNumber } from '@/lib/formatters'
import type { ProductKpiData, ProductRow, TopSellerRow, AbcRow } from '@/pages/Produtos/hooks/useProductData'

type TabKey = 'indicadores' | 'produtos' | 'top' | 'pareto' | 'abc'

interface ProdutoIndicadoresProps {
  kpis: ProductKpiData
  productTable: ProductRow[]
  topSellers: TopSellerRow[]
  abcData: AbcRow[]
  onNavigateTab: (tab: TabKey) => void
}

const ABC_COLORS: Record<string, string> = { A: '#2563eb', B: '#f59e0b', C: '#ef4444' }

const pctChange = (current: number, prev: number) =>
  prev > 0 ? ((current - prev) / prev) * 100 : 0

const ProdutoIndicadores = ({ kpis, productTable, topSellers, abcData, onNavigateTab }: ProdutoIndicadoresProps) => {
  const computed = useMemo(() => {
    // Group revenue by grupo
    const grupoMap = new Map<string, number>()
    for (const p of productTable) {
      grupoMap.set(p.grupo, (grupoMap.get(p.grupo) ?? 0) + p.faturamento)
    }
    const topGrupo = Array.from(grupoMap.entries()).sort((a, b) => b[1] - a[1])[0]

    // Products with zero sales (in abc list but zero quantity)
    const zeroSalesCount = productTable.filter((p) => p.quantidade === 0).length

    // ABC distribution
    const abcCounts = { A: 0, B: 0, C: 0 }
    const abcRevenue = { A: 0, B: 0, C: 0 }
    for (const item of abcData) {
      abcCounts[item.classificacao]++
      abcRevenue[item.classificacao] += item.faturamento
    }
    const abcChartData = (['A', 'B', 'C'] as const).map((cls) => ({
      name: `Classe ${cls}`,
      value: abcCounts[cls],
      revenue: abcRevenue[cls],
      color: ABC_COLORS[cls],
    }))

    // Revenue change
    const revenueChange = pctChange(kpis.faturamento, kpis.prevMonth.faturamento)
    const profitChange = pctChange(kpis.lucroBruto, kpis.prevMonth.lucroBruto)

    // Insights
    const insights: { type: 'positive' | 'warning' | 'info'; text: string }[] = []

    // Top selling product
    if (topSellers.length > 0) {
      insights.push({
        type: 'positive',
        text: `Produto mais vendido: ${topSellers[0].nome} com ${formatNumber(topSellers[0].quantidade)} unidades`,
      })
    }

    // Category with most revenue
    if (topGrupo) {
      insights.push({
        type: 'info',
        text: `Categoria com maior receita: ${topGrupo[0]} (${formatCurrency(topGrupo[1])})`,
      })
    }

    // Margin status
    if (kpis.margemPct >= 20) {
      insights.push({
        type: 'positive',
        text: `Margem saudável de ${kpis.margemPct.toFixed(1)}% no período`,
      })
    } else if (kpis.margemPct >= 10) {
      insights.push({
        type: 'info',
        text: `Margem de ${kpis.margemPct.toFixed(1)}% — atenção ao custo dos produtos`,
      })
    } else {
      insights.push({
        type: 'warning',
        text: `Margem baixa de ${kpis.margemPct.toFixed(1)}% — revisar precificação`,
      })
    }

    // Zero sales
    if (zeroSalesCount > 0) {
      insights.push({
        type: 'warning',
        text: `${zeroSalesCount} produto${zeroSalesCount > 1 ? 's' : ''} sem vendas no período`,
      })
    }

    // Revenue change
    if (kpis.prevMonth.faturamento > 0) {
      if (revenueChange >= 0) {
        insights.push({
          type: 'positive',
          text: `Faturamento cresceu ${revenueChange.toFixed(1)}% em relação ao mês anterior`,
        })
      } else {
        insights.push({
          type: 'warning',
          text: `Faturamento caiu ${Math.abs(revenueChange).toFixed(1)}% em relação ao mês anterior`,
        })
      }
    }

    // Profit change
    if (kpis.prevMonth.lucroBruto > 0 && Math.abs(profitChange) > 5) {
      insights.push({
        type: profitChange >= 0 ? 'positive' : 'warning',
        text: profitChange >= 0
          ? `Lucro bruto cresceu ${profitChange.toFixed(1)}% vs mês anterior`
          : `Lucro bruto caiu ${Math.abs(profitChange).toFixed(1)}% vs mês anterior`,
      })
    }

    // Sort: positive first, then info, then warning
    const order = { positive: 0, info: 1, warning: 2 }
    insights.sort((a, b) => order[a.type] - order[b.type])

    return { topGrupo, abcChartData, abcCounts, insights }
  }, [kpis, productTable, topSellers, abcData])

  const kpiCards = [
    { label: 'Produtos Vendidos', value: formatNumber(kpis.totalProdutosVendidos), icon: Package, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', tab: 'produtos' as TabKey },
    { label: 'Faturamento', value: formatCurrency(kpis.faturamento), icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', tab: 'pareto' as TabKey },
    { label: 'Lucro Bruto', value: formatCurrency(kpis.lucroBruto), icon: TrendingUp, color: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/30', tab: 'produtos' as TabKey },
    { label: 'Margem', value: `${kpis.margemPct.toFixed(1)}%`, icon: BarChart3, color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', tab: 'abc' as TabKey },
    { label: 'Qtd Vendida', value: formatNumber(kpis.quantidade), icon: ShoppingCart, color: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/30', tab: 'top' as TabKey },
    { label: 'Ticket Médio', value: formatCurrency(kpis.ticketMedio), icon: DollarSign, color: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/30', tab: 'produtos' as TabKey },
  ]

  const top5 = topSellers.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => onNavigateTab(card.tab)}
              className={cn('rounded-xl border-l-4 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:bg-gray-900', card.border)}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', card.bg)}>
                  <Icon className={cn('h-4 w-4', card.color)} />
                </div>
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
            </button>
          )
        })}
      </div>

      {/* Insights */}
      {computed.insights.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Insights de Produtos</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {computed.insights.map((ins, i) => (
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
                {ins.type === 'info' && <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
                <p className="text-xs text-gray-700 dark:text-gray-300">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top 5 Products Ranking */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Trophy className="mr-1.5 inline h-4 w-4 text-amber-500" />
              Top 5 Produtos
            </h3>
            <button onClick={() => onNavigateTab('top')} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Ver todos
            </button>
          </div>
          {top5.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {top5.map((p, i) => {
                const maxQtd = top5[0]?.quantidade || 1
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
                        <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">{formatCurrency(p.faturamento)} &middot; Lucro {formatCurrency(p.lucroBruto)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ABC Distribution Donut */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <BarChart3 className="mr-1.5 inline h-4 w-4 text-blue-500" />
              Distribuição ABC
            </h3>
            <button onClick={() => onNavigateTab('abc')} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Ver curva
            </button>
          </div>
          {computed.abcChartData.every((d) => d.value === 0) ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-[160px] shrink-0">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={computed.abcChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {computed.abcChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      formatter={((v: number) => [formatNumber(v), 'Produtos']) as never}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {computed.abcChartData.map((cls) => {
                  const total = computed.abcChartData.reduce((s, x) => s + x.value, 0)
                  const pct = total > 0 ? (cls.value / total) * 100 : 0
                  return (
                    <div key={cls.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cls.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cls.name}</span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct.toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] tabular-nums text-gray-400">
                          {formatNumber(cls.value)} produtos &middot; {formatCurrencyShort(cls.revenue)}
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
    </div>
  )
}

export default ProdutoIndicadores
