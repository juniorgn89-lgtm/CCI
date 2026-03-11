import { useState } from 'react'
import { TrendingUp, BarChart3, AlertCircle, Lightbulb, CheckCircle2, Info } from 'lucide-react'
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
import type { PerformanceProduct, InsightItem } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface PerformanceAnalysisProps {
  highMargin: PerformanceProduct[]
  highVolume: PerformanceProduct[]
  lowSales: PerformanceProduct[]
  insights: InsightItem[]
}

type PerfTab = 'margem' | 'volume' | 'baixaSaida'

const insightIcon: Record<InsightItem['type'], typeof TrendingUp> = {
  positive: CheckCircle2,
  warning: AlertCircle,
  info: Info,
}

const insightColors: Record<InsightItem['type'], { bg: string; border: string; icon: string; title: string }> = {
  positive: {
    bg: 'bg-green-50 dark:bg-green-900/10',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    title: 'text-green-800 dark:text-green-300',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
    title: 'text-amber-800 dark:text-amber-300',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    title: 'text-blue-800 dark:text-blue-300',
  },
}

const ProductList = ({ products, metricLabel, metricKey }: { products: PerformanceProduct[]; metricLabel: string; metricKey: 'margemPct' | 'quantidade' | 'lucroBruto' }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    {/* Chart */}
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Top 10 - {metricLabel}</h3>
      {products.length === 0 ? (
        <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={products.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis
              type="number"
              tickFormatter={metricKey === 'margemPct' ? (v: number) => `${v.toFixed(0)}%` : metricKey === 'quantidade' ? (v: number) => formatNumber(v) : formatCurrencyShort}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={((v: number, name: string) => [
                metricKey === 'margemPct' ? `${v.toFixed(1)}%` : metricKey === 'quantidade' ? formatNumber(v) : formatCurrencyTooltip(v),
                name,
              ]) as never}
            />
            <Bar
              dataKey={metricKey}
              name={metricLabel}
              fill={metricKey === 'margemPct' ? CHART_COLORS[0] : metricKey === 'quantidade' ? CHART_COLORS[1] : '#f59e0b'}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>

    {/* Detail list */}
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalhamento</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {products.slice(0, 10).map((p, idx) => (
          <div key={p.produtoCodigo} className="flex items-center gap-3 px-6 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.nome}</p>
                  <p className="text-xs text-gray-400">{p.grupo}</p>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {metricKey === 'margemPct' ? `${p.margemPct.toFixed(1)}%` : metricKey === 'quantidade' ? formatNumber(p.quantidade) : formatCurrency(p.lucroBruto)}
                  </p>
                  <p className="text-xs tabular-nums text-gray-400">
                    {formatCurrency(p.faturamento)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Sem dados no período.
          </div>
        )}
      </div>
    </div>
  </div>
)

const PerformanceAnalysis = ({ highMargin, highVolume, lowSales, insights }: PerformanceAnalysisProps) => {
  const [perfTab, setPerfTab] = useState<PerfTab>('margem')

  const tabs: { key: PerfTab; label: string; icon: typeof TrendingUp }[] = [
    { key: 'margem', label: 'Maior Margem', icon: TrendingUp },
    { key: 'volume', label: 'Maior Volume', icon: BarChart3 },
    { key: 'baixaSaida', label: 'Baixa Saída', icon: AlertCircle },
  ]

  return (
    <div className="space-y-4">
      {/* Insights panel */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Insights Automáticos</h3>
        </div>

        {insights.length === 0 ? (
          <p className="text-sm text-gray-400">Sem insights disponíveis para o período.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((insight, idx) => {
              const Icon = insightIcon[insight.type]
              const colors = insightColors[insight.type]
              return (
                <div key={idx} className={cn('rounded-lg border p-4', colors.bg, colors.border)}>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', colors.icon)} />
                    <p className={cn('text-sm font-semibold', colors.title)}>{insight.title}</p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{insight.description}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Performance sub-tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setPerfTab(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                perfTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {perfTab === 'margem' && (
        <ProductList products={highMargin} metricLabel="Margem %" metricKey="margemPct" />
      )}
      {perfTab === 'volume' && (
        <ProductList products={highVolume} metricLabel="Quantidade Vendida" metricKey="quantidade" />
      )}
      {perfTab === 'baixaSaida' && (
        <ProductList products={lowSales} metricLabel="Baixa Rotatividade" metricKey="quantidade" />
      )}
    </div>
  )
}

export default PerformanceAnalysis
