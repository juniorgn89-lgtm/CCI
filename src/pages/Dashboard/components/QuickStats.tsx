import { Droplets, Fuel, DollarSign, Receipt, ShoppingBag, Percent } from 'lucide-react'
import { formatCurrency, formatLiters, formatNumber, formatPercent } from '@/lib/formatters'
import type { QuickStats as QuickStatsData } from '@/pages/Dashboard/hooks/useDashboardData'

interface QuickStatsProps {
  quickStats: QuickStatsData
}

interface StatCardConfig {
  label: string
  key: keyof QuickStatsData
  icon: typeof Droplets
  borderColor: string
  iconColor: string
  formatter: (v: number) => string
}

const statCards: StatCardConfig[] = [
  {
    label: 'Litros Vendidos',
    key: 'litrosVendidos',
    icon: Droplets,
    borderColor: 'border-l-blue-500',
    iconColor: 'text-blue-500',
    formatter: formatLiters,
  },
  {
    label: 'Total Abastecimentos',
    key: 'totalAbastecimentos',
    icon: Fuel,
    borderColor: 'border-l-indigo-500',
    iconColor: 'text-indigo-500',
    formatter: (v) => formatNumber(v),
  },
  {
    label: 'Receita do Periodo',
    key: 'receitaDia',
    icon: DollarSign,
    borderColor: 'border-l-emerald-500',
    iconColor: 'text-emerald-500',
    formatter: formatCurrency,
  },
  {
    label: 'Ticket Medio',
    key: 'ticketMedio',
    icon: Receipt,
    borderColor: 'border-l-amber-500',
    iconColor: 'text-amber-500',
    formatter: formatCurrency,
  },
  {
    label: 'Produtos Vendidos',
    key: 'produtosVendidos',
    icon: ShoppingBag,
    borderColor: 'border-l-purple-500',
    iconColor: 'text-purple-500',
    formatter: (v) => formatNumber(v),
  },
  {
    label: 'Margem Media',
    key: 'margemMedia',
    icon: Percent,
    borderColor: 'border-l-rose-500',
    iconColor: 'text-rose-500',
    formatter: formatPercent,
  },
]

const QuickStats = ({ quickStats }: QuickStatsProps) => {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {statCards.map((card) => {
        const Icon = card.icon
        const value = quickStats[card.key]

        return (
          <div
            key={card.key}
            className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900 border-l-4 ${card.borderColor}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {card.label}
              </p>
              <Icon className={`h-4 w-4 ${card.iconColor} opacity-70`} />
            </div>
            <p className="mt-2 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {card.formatter(value)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default QuickStats
