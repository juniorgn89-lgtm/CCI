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
  { color: 'border-blue-500', icon: Fuel, route: '/combustiveis' },
  { color: 'border-green-500', icon: Package, route: '/produtos' },
  { color: 'border-amber-500', icon: Store, route: '/conveniencias' },
]

const SectorCards = ({ data }: SectorCardsProps) => {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              'cursor-pointer rounded-xl border-l-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
              config.color
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{sector.label}</span>
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

            <p className="mt-3 text-2xl font-bold text-gray-900">
              {formatCurrency(sector.faturamento)}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Projeção: {formatCurrency(sector.projecao)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default SectorCards
