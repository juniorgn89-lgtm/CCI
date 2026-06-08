import { TrendingUp, Calendar, ArrowUpRight } from 'lucide-react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'
import { cn } from '@/lib/utils'
import type { ForecastPoint } from '../hooks/useNetworkData'

interface Props {
  forecastData: ForecastPoint[]
}

const fmt = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `R$ ${(v / 1_000).toFixed(1)}K`
      : `R$ ${v.toFixed(0)}`

const SalesForecast = ({ forecastData }: Props) => {
  if (forecastData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-900">
        <TrendingUp className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Dados insuficientes para gerar previsão.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          É necessário pelo menos 2 dias de dados para calcular tendências.
        </p>
      </div>
    )
  }

  const realPoints = forecastData.filter(d => d.real > 0)
  const forecastPoints = forecastData.filter(d => d.forecast !== null)

  const avgReal = realPoints.length > 0 ? realPoints.reduce((s, d) => s + d.real, 0) / realPoints.length : 0
  const avgForecast = forecastPoints.length > 0 ? forecastPoints.reduce((s, d) => s + (d.forecast ?? 0), 0) / forecastPoints.length : 0
  const trendPct = avgReal > 0 ? ((avgForecast - avgReal) / avgReal) * 100 : 0

  const fmtDate = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
  }

  const chartData = forecastData.map(d => ({
    date: fmtDate(d.date),
    real: d.real || null,
    tendencia: d.trend,
    previsao: d.forecast,
  }))

  // Find the split point between real and forecast
  let lastRealIndex = -1
  for (let i = forecastData.length - 1; i >= 0; i--) {
    if (forecastData[i].real > 0) { lastRealIndex = i; break }
  }
  const splitDate = lastRealIndex >= 0 ? fmtDate(forecastData[lastRealIndex].date) : null

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-blue-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-blue-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Média Diária Real</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(avgReal)}</p>
          <p className="text-xs text-gray-400">{realPoints.length} dias de dados</p>
        </div>
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-purple-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-purple-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Previsão Média</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/30">
              <TrendingUp className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(avgForecast)}</p>
          <p className="text-xs text-gray-400">próximos 7 dias</p>
        </div>
        <div className={cn(
          'rounded-lg border border-gray-200/60 bg-gradient-to-br px-3 py-2.5 shadow-sm dark:border-gray-700/60',
          trendPct >= 0
            ? 'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900'
            : 'from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900'
        )}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Tendência</p>
            <div className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              trendPct >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
            )}>
              <ArrowUpRight className={cn('h-3.5 w-3.5', trendPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')} />
            </div>
          </div>
          <p className={cn('mt-1 text-lg font-bold tabular-nums', trendPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {trendPct >= 0 ? '+' : ''}{trendPct.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-400">{trendPct >= 0 ? 'crescimento' : 'queda'} projetado</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Vendas Reais vs Previsão</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Projeção baseada em regressão linear dos dados históricos
          </p>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={((v: number, name: string) => [fmt(v), name]) as never}
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
              />
              <Legend />
              {splitDate && (
                <ReferenceLine x={splitDate} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Hoje', fill: '#94a3b8', fontSize: 11 }} />
              )}
              <Area
                type="monotone"
                dataKey="real"
                name="Vendas Reais"
                stroke="#2563eb"
                fill="url(#realGrad)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="tendencia"
                name="Tendência"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="previsao"
                name="Previsão"
                stroke="#8b5cf6"
                fill="url(#forecastGrad)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Methodology note */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Metodologia:</strong> A previsão utiliza regressão linear simples aplicada sobre os dados de vendas
          do período selecionado. Os valores projetados são uma estimativa baseada na tendência observada e não consideram
          sazonalidade ou eventos especiais.
        </p>
      </div>
    </div>
  )
}

export default SalesForecast
