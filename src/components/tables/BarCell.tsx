import { cn } from '@/lib/utils'

interface BarCellProps {
  value: number
  /** Maior valor da coluna — define 100% da barra. */
  max: number
  formatted: string
  color?: 'blue' | 'green' | 'red' | 'amber'
  /** Largura máxima da barra como % da célula (default 100). */
  maxWidthPct?: number
  /**
   * 'fill' (default): barra cresce do canto esquerdo da célula.
   * 'near': barra cresce do canto direito (cola no número à direita).
   * Em ambos os modos o número fica por cima, alinhado à direita.
   */
  align?: 'fill' | 'near'
}

/**
 * Célula de tabela com uma barra proporcional ao valor. Use `align="near"`
 * para a barra crescer a partir do número (lado direito) em vez do canto
 * esquerdo da célula.
 */
const BarCell = ({
  value,
  max,
  formatted,
  color = 'blue',
  maxWidthPct = 100,
  align = 'fill',
}: BarCellProps) => {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const pct = ratio * maxWidthPct
  const bar =
    color === 'green'
      ? 'bg-emerald-100 dark:bg-emerald-900/30'
      : color === 'red'
        ? 'bg-red-100 dark:bg-red-900/30'
        : color === 'amber'
          ? 'bg-amber-100 dark:bg-amber-900/30'
          : 'bg-blue-100 dark:bg-blue-900/30'
  const text =
    color === 'red' ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'

  return (
    <div className="relative flex h-6 items-center justify-end overflow-hidden rounded">
      <span
        className={cn('absolute inset-y-0 rounded', bar, align === 'near' ? 'right-0' : 'left-0')}
        style={{ width: `${pct}%` }}
      />
      <span className={cn('relative px-1.5 text-sm tabular-nums', text)}>{formatted}</span>
    </div>
  )
}

export default BarCell
