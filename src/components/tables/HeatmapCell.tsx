import { cn } from '@/lib/utils'

interface HeatmapCellProps {
  value: number
  min?: number
  max?: number
  formatted?: string
}

const HeatmapCell = ({ value, min = -100, max = 100, formatted }: HeatmapCellProps) => {
  const range = max - min || 1
  const normalized = Math.max(0, Math.min(1, (value - min) / range))

  const isPositive = value >= 0

  // Map normalized intensity to background classes
  // 0–0.25 → lightest, 0.25–0.5 → light, 0.5–0.75 → medium, 0.75–1 → strong
  const getBgClass = () => {
    if (isPositive) {
      if (normalized > 0.75) return 'bg-green-200 text-green-900'
      if (normalized > 0.5) return 'bg-green-100 text-green-800'
      return 'bg-green-50 text-green-700'
    }
    const inversed = 1 - normalized
    if (inversed > 0.75) return 'bg-red-200 text-red-900'
    if (inversed > 0.5) return 'bg-red-100 text-red-800'
    return 'bg-red-50 text-red-700'
  }

  return (
    <span
      className={cn(
        'inline-block rounded px-2 py-0.5 text-sm font-medium',
        getBgClass()
      )}
    >
      {formatted ?? value.toFixed(1)}
    </span>
  )
}

export default HeatmapCell
