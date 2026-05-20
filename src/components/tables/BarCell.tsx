import { cn } from '@/lib/utils'

interface BarCellProps {
  value: number
  /** Maior valor da coluna — define 100% da barra. */
  max: number
  formatted: string
  color?: 'blue' | 'green'
}

/**
 * Célula de tabela com uma barra de fundo sutil proporcional ao valor (estilo
 * "data bar"). A barra cresce da esquerda; o número fica à direita por cima.
 */
const BarCell = ({ value, max, formatted, color = 'blue' }: BarCellProps) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const bar = color === 'green'
    ? 'bg-emerald-100 dark:bg-emerald-900/30'
    : 'bg-blue-100 dark:bg-blue-900/30'
  return (
    <div className="relative flex h-6 items-center justify-end overflow-hidden rounded">
      <span className={cn('absolute inset-y-0 left-0 rounded', bar)} style={{ width: `${pct}%` }} />
      <span className="relative px-1.5 text-sm tabular-nums text-gray-900 dark:text-gray-100">{formatted}</span>
    </div>
  )
}

export default BarCell
