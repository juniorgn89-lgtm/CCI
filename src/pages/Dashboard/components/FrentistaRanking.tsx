import { Trophy } from 'lucide-react'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { FrentistaRankingItem } from '@/pages/Dashboard/hooks/useDashboardData'

interface FrentistaRankingProps {
  frentistaRanking: FrentistaRankingItem[]
}

const medalColors: Record<number, string> = {
  0: 'bg-amber-400 text-white',
  1: 'bg-gray-300 text-gray-700',
  2: 'bg-amber-600 text-white',
}

const rowHighlight: Record<number, string> = {
  0: 'bg-amber-50/50 dark:bg-amber-950/10',
  1: 'bg-gray-50/50 dark:bg-gray-800/20',
  2: 'bg-amber-50/30 dark:bg-amber-950/5',
}

const FrentistaRanking = ({ frentistaRanking }: FrentistaRankingProps) => {
  if (frentistaRanking.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-400 dark:text-gray-500">Sem dados de frentistas.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Ranking de Frentistas
        </h3>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: '332px' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
              <th className="px-5 py-2.5 text-left">#</th>
              <th className="px-2 py-2.5 text-left">Frentista</th>
              <th className="px-2 py-2.5 text-right">Litros</th>
              <th className="px-5 py-2.5 text-right">Receita</th>
            </tr>
          </thead>
          <tbody>
            {frentistaRanking.map((item, index) => {
              const isTop3 = index < 3
              return (
                <tr
                  key={item.codigoFrentista}
                  className={cn(
                    'border-b border-gray-50 transition-colors last:border-0 dark:border-gray-800/50',
                    isTop3 ? rowHighlight[index] : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  )}
                >
                  <td className="px-5 py-2.5">
                    {isTop3 ? (
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                          medalColors[index]
                        )}
                      >
                        {index + 1}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{index + 1}</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={cn('text-sm', isTop3 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>
                      Frentista {item.codigoFrentista}
                    </span>
                    <span className="ml-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                      {item.atendimentos} atend.
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatLiters(item.litros)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatCurrency(item.receita)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default FrentistaRanking
