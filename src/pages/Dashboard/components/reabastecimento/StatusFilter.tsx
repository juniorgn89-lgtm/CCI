import { cn } from '@/lib/utils'

/** Filtro de status (segmented) dos cards de item. Burro. */
const StatusFilter = ({ options, active, onChange }: {
  options: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) => (
  <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        onClick={() => onChange(o.id)}
        className={cn(
          'inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors',
          active === o.id
            ? 'bg-[#1e3a5f] text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
)

export default StatusFilter
