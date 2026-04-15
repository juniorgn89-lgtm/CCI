import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber, formatLiters, formatLitersShort } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { DailyTrend } from '@/pages/Operacao/components/ProdutividadeTab'

interface AnaliseTendenciaProps {
  trends: DailyTrend[]
}

const AnaliseTendencia = ({ trends }: AnaliseTendenciaProps) => {
  if (trends.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Nenhum dado de tendência no período.
      </div>
    )
  }

  // Compute variation indicators (first half vs second half)
  const mid = Math.floor(trends.length / 2)
  const firstHalf = trends.slice(0, mid)
  const secondHalf = trends.slice(mid)

  const avgFirst = (arr: DailyTrend[], key: 'litros' | 'atendimentos' | 'faturamento') =>
    arr.length > 0 ? arr.reduce((s, d) => s + d[key], 0) / arr.length : 0

  const computeVariation = (key: 'litros' | 'atendimentos' | 'faturamento') => {
    const a = avgFirst(firstHalf, key)
    const b = avgFirst(secondHalf, key)
    if (a === 0) return 0
    return ((b - a) / a) * 100
  }

  const litrosVar = computeVariation('litros')
  const atendVar = computeVariation('atendimentos')
  const fatVar = computeVariation('faturamento')

  const TrendIcon = (v: number) => {
    if (v > 2) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (v < -2) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const trendColor = (v: number) => v > 2 ? 'text-green-600 dark:text-green-400' : v < -2 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'

  const totals = {
    litros: trends.reduce((s, d) => s + d.litros, 0),
    atendimentos: trends.reduce((s, d) => s + d.atendimentos, 0),
    faturamento: trends.reduce((s, d) => s + d.faturamento, 0),
  }

  const summaryCards = [
    { label: 'Litros no Período', value: formatLiters(totals.litros), variation: litrosVar },
    { label: 'Atendimentos no Período', value: formatNumber(totals.atendimentos), variation: atendVar },
    { label: 'Faturamento no Período', value: formatCurrency(totals.faturamento), variation: fatVar },
  ]

  return (
    <div className="space-y-5">
      {/* Summary with trend */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {summaryCards.map((card, idx) => {
          const gradients = [
            'from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900',
            'from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
            'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
          ]
          const iconBgs = [
            'bg-cyan-100 dark:bg-cyan-900/30',
            'bg-blue-100 dark:bg-blue-900/30',
            'bg-emerald-100 dark:bg-emerald-900/30',
          ]
          return (
          <div key={card.label} className={cn('rounded-lg border border-gray-200/60 bg-gradient-to-br px-3 py-2.5 shadow-sm dark:border-gray-700/60', gradients[idx])}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.label}</p>
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', iconBgs[idx])}>
                {TrendIcon(card.variation)}
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={cn('text-sm font-semibold tabular-nums', trendColor(card.variation))}>
                {card.variation > 0 ? '+' : ''}{card.variation.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400">vs primeira metade</span>
            </div>
          </div>
          )
        })}
      </div>

      {/* Litros trend */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Evolução de Litros Vendidos</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trends} margin={{ left: 10, right: 20 }}>
            <defs>
              <linearGradient id="litrosGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis dataKey="dataFormatada" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatLitersShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={((v: number) => [formatLiters(v), 'Litros']) as never}
            />
            <Area type="monotone" dataKey="litros" stroke="#06b6d4" strokeWidth={2} fill="url(#litrosGrad)" dot={false} activeDot={{ r: 5, fill: '#06b6d4' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Atendimentos trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Evolução de Atendimentos</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trends} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis dataKey="dataFormatada" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number) => [formatNumber(v), 'Atendimentos']) as never}
              />
              <Line type="monotone" dataKey="atendimentos" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#2563eb' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Faturamento trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Evolução do Faturamento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trends} margin={{ left: 10, right: 20 }}>
              <defs>
                <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis dataKey="dataFormatada" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number) => [formatCurrencyTooltip(v), 'Faturamento']) as never}
              />
              <Area type="monotone" dataKey="faturamento" stroke="#22c55e" strokeWidth={2} fill="url(#fatGrad)" dot={false} activeDot={{ r: 5, fill: '#22c55e' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default AnaliseTendencia
