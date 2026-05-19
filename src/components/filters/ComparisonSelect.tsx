import { useFilterStore, type ComparisonMode } from '@/store/filters'
import { cn } from '@/lib/utils'

interface Option {
  value: ComparisonMode
  label: string
  title: string
}

const options: Option[] = [
  { value: 'prevMonth', label: 'vs mês ant.', title: 'Comparar com o mesmo período do mês anterior' },
  { value: 'prevYear', label: 'vs ano ant.', title: 'Comparar com o mesmo período do ano anterior' },
]

/**
 * Segmented control que define o benchmark de comparação dos KPIs.
 * A escolha persiste no filter store e é compartilhada por todas as telas
 * que mostram variação (Central da Rede, Resumo do Posto, etc.).
 */
const ComparisonSelect = () => {
  const mode = useFilterStore((s) => s.comparisonMode)
  const setMode = useFilterStore((s) => s.setComparisonMode)

  return (
    <div
      role="radiogroup"
      aria-label="Comparar com"
      className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800"
    >
      {options.map((opt) => {
        const isActive = mode === opt.value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            title={opt.title}
            onClick={() => setMode(opt.value)}
            className={cn(
              'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
              isActive
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default ComparisonSelect
