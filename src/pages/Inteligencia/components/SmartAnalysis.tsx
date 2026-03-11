import { Lightbulb, TrendingUp, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NetworkInsight } from '../hooks/useNetworkData'

interface Props {
  insights: NetworkInsight[]
}

const typeConfig = {
  positive: {
    icon: TrendingUp,
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Destaque',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Atenção',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Informação',
  },
}

const SmartAnalysis = ({ insights }: Props) => {
  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-900">
        <Lightbulb className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Selecione mais postos para gerar insights comparativos.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          A análise inteligente compara o desempenho entre os postos da rede.
        </p>
      </div>
    )
  }

  const positive = insights.filter(i => i.type === 'positive')
  const warnings = insights.filter(i => i.type === 'warning')
  const infos = insights.filter(i => i.type === 'info')

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Destaques</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{positive.length}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">postos acima da média</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-700 dark:text-amber-300">Atenção</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">{warnings.length}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">pontos de atenção</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-blue-700 dark:text-blue-300">Informações</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">{infos.length}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">insights identificados</p>
        </div>
      </div>

      {/* Insight cards */}
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const config = typeConfig[insight.type]
          const Icon = config.icon
          return (
            <div
              key={i}
              className={cn(
                'flex items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-sm',
                config.bg,
                config.border
              )}
            >
              <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.bg)}>
                <Icon className={cn('h-4 w-4', config.iconColor)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-semibold uppercase tracking-wide', config.iconColor)}>
                    {config.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-semibold">{insight.posto}</span>{' '}
                  {insight.message}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SmartAnalysis
