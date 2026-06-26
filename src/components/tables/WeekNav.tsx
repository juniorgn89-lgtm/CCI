import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { weekChipLabel } from '@/lib/weekGroups'

interface WeekNavProps {
  /** Semanas, da mais antiga (esquerda) pra mais recente (direita). */
  weeks: { monday: string; min: string; max: string }[]
  activeIdx: number
  onSelect: (monday: string) => void
}

/**
 * Navegação por semana (seg–dom): setas ‹ › + chips com o intervalo de cada
 * semana. Some quando há 0 ou 1 semana (não há o que navegar). Padrão usado nas
 * tabelas "Realizado dia a dia" de Combustível, Automotivo e Conveniência.
 */
const WeekNav = ({ weeks, activeIdx, onSelect }: WeekNavProps) => {
  if (weeks.length <= 1) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 px-4 pb-1 pt-3">
      <button
        type="button"
        aria-label="Semana anterior"
        disabled={activeIdx <= 0}
        onClick={() => onSelect(weeks[Math.max(activeIdx - 1, 0)].monday)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {weeks.map((s, i) => (
          <button
            key={s.monday}
            type="button"
            onClick={() => onSelect(s.monday)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors',
              i === activeIdx
                ? 'bg-[#1e3a5f] text-white dark:bg-blue-600'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            {weekChipLabel(s.min, s.max)}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Próxima semana"
        disabled={activeIdx >= weeks.length - 1}
        onClick={() => onSelect(weeks[Math.min(activeIdx + 1, weeks.length - 1)].monday)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default WeekNav
