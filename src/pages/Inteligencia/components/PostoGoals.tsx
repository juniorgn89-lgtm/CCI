import { Target, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostoGoal } from '../hooks/useNetworkData'

interface Props {
  goals: PostoGoal[]
}

const fmt = (v: number, unit: string) => {
  if (unit === 'R$') {
    return v >= 1_000_000
      ? `R$ ${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
        ? `R$ ${(v / 1_000).toFixed(1)}K`
        : `R$ ${v.toFixed(2)}`
  }
  if (unit === 'L') {
    return v >= 1_000 ? `${(v / 1_000).toFixed(1)}K L` : `${v.toFixed(0)} L`
  }
  return `${v.toFixed(1)}${unit}`
}

const PostoGoals = ({ goals }: Props) => {
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-900">
        <Target className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Selecione postos para visualizar as metas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 dark:border-blue-800 dark:bg-blue-900/20">
        <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          As metas são calculadas como 110% da média da rede para cada indicador.
        </p>
      </div>

      {/* Goals per posto */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {goals.map(posto => {
          const avgPercent = posto.goals.reduce((s, g) => s + g.percent, 0) / posto.goals.length
          return (
            <div
              key={posto.empresaCodigo}
              className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    avgPercent >= 90
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : avgPercent >= 60
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-amber-100 dark:bg-amber-900/30'
                  )}>
                    {avgPercent >= 90 ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : avgPercent >= 60 ? (
                      <Target className="h-4 w-4 text-blue-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{posto.nome}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.round(avgPercent)}% das metas atingidas
                    </p>
                  </div>
                </div>
                <div className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  avgPercent >= 90
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : avgPercent >= 60
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                )}>
                  {Math.round(avgPercent)}%
                </div>
              </div>

              <div className="space-y-4 p-5">
                {posto.goals.map(goal => (
                  <div key={goal.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{goal.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {fmt(goal.current, goal.unit)} / {fmt(goal.target, goal.unit)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            goal.percent >= 90
                              ? 'bg-emerald-500'
                              : goal.percent >= 60
                                ? 'bg-blue-500'
                                : goal.percent >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                          )}
                          style={{ width: `${Math.min(goal.percent, 100)}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-xs font-semibold tabular-nums',
                        goal.percent >= 90
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : goal.percent >= 60
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-amber-600 dark:text-amber-400'
                      )}>
                        {goal.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PostoGoals
