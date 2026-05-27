import { TrendingUp, TrendingDown, Award, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MOCK_INSIGHTS, type MockInsight } from './mockData'

const iconByTipo: Record<MockInsight['tipo'], typeof TrendingUp> = {
  crescimento: TrendingUp,
  queda: TrendingDown,
  destaque: Award,
  alerta: AlertTriangle,
}

const styleByTipo: Record<MockInsight['tipo'], { ring: string; iconBg: string; iconText: string; pill: string }> = {
  crescimento: {
    ring: 'ring-emerald-200 dark:ring-emerald-500/20',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  queda: {
    ring: 'ring-red-200 dark:ring-red-500/20',
    iconBg: 'bg-red-50 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400',
    pill: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  destaque: {
    ring: 'ring-purple-200 dark:ring-purple-500/20',
    iconBg: 'bg-purple-50 dark:bg-purple-900/30',
    iconText: 'text-purple-600 dark:text-purple-400',
    pill: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  alerta: {
    ring: 'ring-amber-200 dark:ring-amber-500/20',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    iconText: 'text-amber-600 dark:text-amber-400',
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
}

const InsightsPanel = () => {
  const [refreshing, setRefreshing] = useState(false)

  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 900)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-md shadow-purple-500/20">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Insights Automáticos</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Padrões detectados pela IA com base nos últimos 30 dias
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MOCK_INSIGHTS.map((i) => {
          const Icon = iconByTipo[i.tipo]
          const s = styleByTipo[i.tipo]
          return (
            <div
              key={i.id}
              className={cn(
                'group rounded-xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-inset transition-all hover:shadow-md dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-900 dark:to-[#0a0a0a]',
                s.ring,
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', s.iconBg)}>
                  <Icon className={cn('h-4 w-4', s.iconText)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{i.title}</h4>
                    {i.delta !== 0 && (
                      <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums', s.pill)}>
                        {i.delta > 0 ? '+' : ''}{i.delta.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{i.body}</p>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {i.metrica}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default InsightsPanel
