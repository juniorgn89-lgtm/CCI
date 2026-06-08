import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string
  icon: LucideIcon
  variation?: number
  previousValue?: string
}

const KpiCard = ({ label, value, icon: Icon, variation, previousValue }: KpiCardProps) => {
  const isPositive = variation !== undefined && variation >= 0
  const isNegative = variation !== undefined && variation < 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-gray-500" />
          <span className="text-xs font-medium text-gray-500">{label}</span>
        </div>
        {variation !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              isPositive && 'text-green-500',
              isNegative && 'text-red-500'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>{isPositive ? '+' : ''}{variation.toFixed(0)}%</span>
          </div>
        )}
      </div>

      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>

      {previousValue && (
        <p className="mt-1 text-sm text-gray-500">
          vs. anterior: {previousValue}
        </p>
      )}
    </div>
  )
}

export default KpiCard
