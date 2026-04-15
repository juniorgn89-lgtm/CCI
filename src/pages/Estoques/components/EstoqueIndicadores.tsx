import { useMemo } from 'react'
import {
  Package, Layers, AlertTriangle, XCircle, Lightbulb,
  ArrowUpRight, ArrowDownRight, Clock, TrendingDown, FolderOpen,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatNumber, formatCurrency } from '@/lib/formatters'
import type {
  StockKpiData, StockRow, AlertItem, CategoryStock, StatusBreakdown,
} from '@/pages/Estoques/hooks/useStockData'
import type { SeverityFilter } from '@/pages/Estoques/components/StockAlerts'

type TabKey = 'indicadores' | 'posicao' | 'movimentacao' | 'alertas' | 'historico' | 'analise'

interface EstoqueIndicadoresProps {
  kpis: StockKpiData
  stockTable: StockRow[]
  alerts: AlertItem[]
  categoryStock: CategoryStock[]
  statusBreakdown: StatusBreakdown[]
  onNavigateTab: (tab: TabKey, alertFilter?: SeverityFilter) => void
}

const DONUT_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444', '#991b1b']

const EstoqueIndicadores = ({
  kpis,
  stockTable,
  alerts,
  categoryStock,
  statusBreakdown,
  onNavigateTab,
}: EstoqueIndicadoresProps) => {
  const computed = useMemo(() => {
    // Negative stock items
    const negativoCount = stockTable.filter((r) => r.saldo < 0).length

    // Category with most products
    const topCategory = categoryStock.length > 0 ? categoryStock[0] : null

    // Total stock value (sum of all saldos — approximate as unit count)
    const totalSaldo = stockTable.reduce((sum, r) => sum + r.saldo, 0)

    // Unique categories count
    const totalCategorias = new Set(stockTable.map((r) => r.categoria)).size

    // Insights
    const insights: { type: 'positive' | 'warning' | 'info'; text: string }[] = []

    if (kpis.produtosSemEstoque > 0) {
      insights.push({
        type: 'warning',
        text: `${formatNumber(kpis.produtosSemEstoque)} produto${kpis.produtosSemEstoque > 1 ? 's' : ''} com estoque zerado`,
      })
    }

    if (kpis.produtosBaixoEstoque > 0) {
      insights.push({
        type: 'warning',
        text: `${formatNumber(kpis.produtosBaixoEstoque)} produto${kpis.produtosBaixoEstoque > 1 ? 's' : ''} com estoque baixo (≤20 un.)`,
      })
    }

    if (negativoCount > 0) {
      insights.push({
        type: 'warning',
        text: `${formatNumber(negativoCount)} produto${negativoCount > 1 ? 's' : ''} com saldo negativo — verificar ajustes`,
      })
    }

    if (topCategory) {
      insights.push({
        type: 'info',
        text: `Categoria "${topCategory.categoria}" lidera com ${formatNumber(topCategory.produtos)} produtos e saldo de ${formatNumber(topCategory.saldo)} un.`,
      })
    }

    const normalCount = statusBreakdown.find((s) => s.status === 'normal')?.count ?? 0
    if (kpis.totalProdutos > 0) {
      const normalPct = (normalCount / kpis.totalProdutos) * 100
      if (normalPct >= 80) {
        insights.push({
          type: 'positive',
          text: `${normalPct.toFixed(0)}% dos produtos em nível normal de estoque`,
        })
      } else if (normalPct < 50) {
        insights.push({
          type: 'warning',
          text: `Apenas ${normalPct.toFixed(0)}% dos produtos em nível normal — atenção requerida`,
        })
      }
    }

    if (totalCategorias > 0) {
      insights.push({
        type: 'info',
        text: `${formatNumber(totalCategorias)} categorias de produtos no estoque`,
      })
    }

    // Sort: positive first, then info, then warning
    const order = { positive: 0, info: 1, warning: 2 }
    insights.sort((a, b) => order[a.type] - order[b.type])

    return { negativoCount, topCategory, totalSaldo, insights }
  }, [kpis, stockTable, categoryStock, statusBreakdown])

  const kpiCards = [
    {
      label: 'Total de Produtos',
      value: formatNumber(kpis.totalProdutos),
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      tab: 'posicao' as TabKey,
    },
    {
      label: 'Saldo Total',
      value: formatNumber(kpis.saldoTotal),
      icon: Layers,
      color: 'text-emerald-600 dark:text-emerald-400',
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      tab: 'movimentacao' as TabKey,
    },
    {
      label: 'Estoque Baixo',
      value: formatNumber(kpis.produtosBaixoEstoque),
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      tab: 'alertas' as TabKey,
      alertFilter: 'caution' as SeverityFilter,
    },
    {
      label: 'Sem Estoque',
      value: formatNumber(kpis.produtosSemEstoque),
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      cardBg: 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      tab: 'alertas' as TabKey,
      alertFilter: 'danger' as SeverityFilter,
    },
  ]

  // Filter out statuses with 0 count for the donut chart
  const donutData = statusBreakdown.filter((s) => s.count > 0)
  const totalDonut = donutData.reduce((sum, s) => sum + s.count, 0)

  // Top 8 categories for ranking
  const topCategories = categoryStock.slice(0, 8)
  const maxCategorySaldo = topCategories.length > 0 ? topCategories[0].saldo : 1

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => onNavigateTab(card.tab, card.alertFilter)}
              className={cn(
                'rounded-lg border border-gray-200/60 px-3 py-2.5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700/60',
                card.cardBg,
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', card.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', card.color)} />
                </div>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {card.value}
              </p>
            </button>
          )
        })}
      </div>

      {/* Insights */}
      {computed.insights.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Insights do Estoque</h3>
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
                {ins.type === 'warning' && <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                {ins.type === 'info' && <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
                <p className="text-xs text-gray-700 dark:text-gray-300">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status breakdown donut */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Package className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Distribuição por Status
          </h3>
          {donutData.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-[160px] shrink-0">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                      formatter={((v: number) => [formatNumber(v), 'Produtos']) as never}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {donutData.map((s) => {
                  const pct = totalDonut > 0 ? (s.count / totalDonut) * 100 : 0
                  return (
                    <div key={s.status} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs text-gray-700 dark:text-gray-300">
                            {s.label}
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-[10px] tabular-nums text-gray-400">
                          {formatNumber(s.count)} produto{s.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mini KPIs below donut */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatNumber(kpis.totalProdutos)}
              </p>
              <p className="text-[10px] text-gray-400">Total Produtos</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatNumber(kpis.saldoTotal)}
              </p>
              <p className="text-[10px] text-gray-400">Saldo Total (un.)</p>
            </div>
            <div className="text-center">
              <p className={cn(
                'text-lg font-bold tabular-nums',
                totalDonut > 0 && ((totalDonut - (kpis.produtosSemEstoque + computed.negativoCount)) / totalDonut) * 100 >= 50
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              )}>
                {totalDonut > 0 ? (((totalDonut - (kpis.produtosSemEstoque + computed.negativoCount)) / totalDonut) * 100).toFixed(1) : '0'}%
              </p>
              <p className="text-[10px] text-gray-400">Cobertura</p>
            </div>
          </div>
        </div>

        {/* Top categories by stock */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <FolderOpen className="mr-1.5 inline h-4 w-4 text-indigo-500" />
              Top Categorias por Saldo
            </h3>
            <button
              onClick={() => onNavigateTab('posicao')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Ver todos
            </button>
          </div>
          {topCategories.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {topCategories.map((cat, i) => {
                const pct = maxCategorySaldo > 0 ? (Math.max(cat.saldo, 0) / maxCategorySaldo) * 100 : 0
                return (
                  <div key={cat.categoria} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        i === 0
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm text-gray-900 dark:text-gray-100">
                          {cat.categoria}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {formatNumber(cat.saldo)} un.
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className="h-1.5 rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                        {formatNumber(cat.produtos)} produto{cat.produtos !== 1 ? 's' : ''}
                      </p>
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

export default EstoqueIndicadores
