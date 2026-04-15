import { Droplets, Fuel, DollarSign, Receipt, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber, formatPercent } from '@/lib/formatters'
import type { QuickStats as QuickStatsData } from '@/pages/Dashboard/hooks/useDashboardData'

interface QuickStatsProps {
  quickStats: QuickStatsData
}

interface StatCardConfig {
  label: string
  key: keyof QuickStatsData
  icon: typeof Droplets
  cardBg: string
  iconBg: string
  iconColor: string
  formatter: (v: number) => string
}

const statCards: StatCardConfig[] = [
  {
    label: 'Litros Vendidos',
    key: 'litrosVendidos',
    icon: Droplets,
    cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    formatter: formatLiters,
  },
  {
    label: 'Receita',
    key: 'receitaDia',
    icon: DollarSign,
    cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    formatter: formatCurrency,
  },
  {
    label: 'Ticket Médio',
    key: 'ticketMedio',
    icon: Receipt,
    cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    formatter: formatCurrency,
  },
  {
    label: 'Abastecimentos',
    key: 'totalAbastecimentos',
    icon: Fuel,
    cardBg: 'bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-gray-900',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    formatter: (v) => formatNumber(v),
  },
  {
    label: 'Margem',
    key: 'margemMedia',
    icon: Percent,
    cardBg: 'bg-gradient-to-br from-rose-50/60 to-white dark:from-rose-950/20 dark:to-gray-900',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    formatter: formatPercent,
  },
]

const QuickStats = ({ quickStats }: QuickStatsProps) => {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
      {statCards.map((card) => {
        const Icon = card.icon
        const value = quickStats[card.key]

        return (
          <div
            key={card.key}
            className={cn(
              'rounded-lg border border-gray-200/60 px-3 py-2.5 shadow-sm dark:border-gray-700/60',
              card.cardBg
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {card.label}
              </p>
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', card.iconBg)}>
                <Icon className={cn('h-3.5 w-3.5', card.iconColor)} />
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {card.formatter(value)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default QuickStats
