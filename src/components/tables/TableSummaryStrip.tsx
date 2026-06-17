import { HelpCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricItem {
  label: string
  value: string
  /** Small note below the value (e.g. "+1 aberto", "parcial") */
  hint?: string
  color?: string
}

interface TableSummaryStripProps {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  title: string
  subtitle?: string
  metrics: MetricItem[]
  accentGradient?: string
  /** Tooltip "?" ao lado do título, explicando o que a tabela mostra. */
  titleHint?: string
}

const TableSummaryStrip = ({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  metrics,
  accentGradient = 'bg-gradient-to-r from-blue-50/80 to-white dark:from-blue-950/30 dark:to-gray-900',
  titleHint,
}: TableSummaryStripProps) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-gray-200 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700',
        accentGradient
      )}
    >
      {/* Left: icon + title */}
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            iconBg
          )}
        >
          <Icon className={cn('h-4.5 w-4.5', iconColor)} />
        </div>
        <div>
          <h3 className="flex items-center gap-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            {title}
            {titleHint && (
              <span title={titleHint} className="inline-flex cursor-help text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300">
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            )}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: metric mini-cards */}
      <div className="flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-[90px] rounded-md border border-gray-200/80 bg-white px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {metric.label}
            </p>
            <p
              className={cn(
                'text-sm font-bold tabular-nums',
                metric.color ?? 'text-gray-900 dark:text-gray-100'
              )}
            >
              {metric.value}
            </p>
            {metric.hint && (
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {metric.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TableSummaryStrip
