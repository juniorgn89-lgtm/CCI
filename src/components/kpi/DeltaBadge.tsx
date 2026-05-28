import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeltaBadgeProps {
  current: number
  previous: number
  /** Show absolute values below delta (e.g. "6.924 vs 10.919") */
  showAbsolute?: boolean
  formatter?: (v: number) => string
  /** Invert colors — useful for costs where lower is better */
  invertColors?: boolean
  /** Texto do benchmark exibido após "vs" (ex.: "mês ant.", "ano ant."). Default "anterior". */
  label?: string
  className?: string
}

const DeltaBadge = ({
  current,
  previous,
  showAbsolute,
  formatter,
  invertColors = false,
  label = 'anterior',
  className,
}: DeltaBadgeProps) => {
  if (!previous || previous === 0) return null

  const pct = ((current - previous) / previous) * 100
  const isPositive = pct >= 0
  const isGood = invertColors ? !isPositive : isPositive
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <div className={cn('mt-1 flex flex-col gap-0.5', className)}>
      <div className={cn(
        'flex items-center gap-1',
        isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}>
        <Icon className="h-3 w-3 shrink-0" />
        <span className="text-[10px] font-semibold tabular-nums">
          {isPositive ? '+' : ''}{pct.toFixed(1)}% vs {label}
        </span>
      </div>
      {showAbsolute && formatter && (
        <p className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
          {formatter(current)} vs {formatter(previous)}
        </p>
      )}
    </div>
  )
}

/** For margin cards: green ≥ threshold, yellow near threshold, red below */
export const MarginBadge = ({ value, threshold = 5 }: { value: number; threshold?: number }) => {
  const isGood = value >= threshold
  const isWarn = !isGood && value >= threshold * 0.6
  return (
    <span className={cn(
      'mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
      isGood && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      isWarn && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      !isGood && !isWarn && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    )}>
      {isGood ? '✓ Saudável' : isWarn ? '⚠ Atenção' : '✕ Baixa'}
    </span>
  )
}

export default DeltaBadge
