import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SegmentKpiMiniProps {
  label: string
  value: string
  variation: number
  /** When true, a negative variation is treated as good (e.g. for Custo). */
  invertColor?: boolean
}

const SegmentKpiMini = ({ label, value, variation, invertColor }: SegmentKpiMiniProps) => {
  const positive = variation >= 0
  const goodColor = invertColor ? !positive : positive
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      <p className={cn('mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium', goodColor ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {positive ? '+' : ''}{variation.toFixed(0).replace('.', ',')}%
      </p>
    </div>
  )
}

export default SegmentKpiMini
