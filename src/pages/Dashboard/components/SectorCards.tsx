import { useNavigate } from 'react-router-dom'
import { Fuel, Package, Store, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface SectorCard {
  label: string
  faturamento: number
  variacao: number
  projecao: number
}

interface SectorCardsProps {
  data: SectorCard[]
}

const sectorConfig = [
  { cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', icon: Fuel, route: '/combustiveis' },
  { cardBg: 'bg-gradient-to-br from-green-50/60 to-white dark:from-green-950/20 dark:to-gray-900', iconBg: 'bg-green-100 dark:bg-green-900/30', iconColor: 'text-green-600 dark:text-green-400', icon: Package, route: '/produtos' },
  { cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400', icon: Store, route: '/conveniencias' },
]

const SectorCards = ({ data }: SectorCardsProps) => {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
      {data.map((sector, index) => {
        const config = sectorConfig[index]
        const Icon = config.icon
        const isPositive = sector.variacao >= 0

        return (
          <div
            key={sector.label}
            onClick={() => navigate(`${config.route}?from=dashboard`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${config.route}?from=dashboard`) } }}
            role="button"
            tabIndex={0}
            aria-label={`Ir para ${sector.label}`}
            className={cn(
              'cursor-pointer rounded-lg border border-gray-200/60 px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700/60',
              config.cardBg
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', config.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{sector.label}</span>
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  isPositive ? 'text-green-500' : 'text-red-500'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{isPositive ? '+' : ''}{sector.variacao.toFixed(1)}%</span>
              </div>
            </div>

            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(sector.faturamento)}
            </p>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Projeção: {formatCurrency(sector.projecao)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default SectorCards
