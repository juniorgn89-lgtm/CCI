import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReposicaoSetor } from '@/pages/Dashboard/components/reabastecimento/types'

export interface SubTab {
  id: ReposicaoSetor
  label: string
  Icon: LucideIcon
  /** Contador de alertas da sub-aba (badge). */
  count?: number
  /** Sub-aba ainda não implementada (Fase 2/3) — desabilitada. */
  disabled?: boolean
}

/** Sub-tab switcher Combustível · Automotivo · Conveniência. Burro. */
const SubTabSwitcher = ({ tabs, active, onChange }: {
  tabs: SubTab[]
  active: ReposicaoSetor
  onChange: (id: ReposicaoSetor) => void
}) => (
  <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
    {tabs.map((t) => {
      const isActive = active === t.id
      return (
        <button
          key={t.id}
          type="button"
          disabled={t.disabled}
          onClick={() => !t.disabled && onChange(t.id)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors',
            isActive
              ? 'bg-[#1e3a5f] text-white shadow-sm'
              : t.disabled
                ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          <t.Icon className="h-4 w-4" />
          {t.label}
          {t.count != null && t.count > 0 && (
            <span className={cn(
              'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
              isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
            )}>
              {t.count}
            </span>
          )}
          {t.disabled && <span className="text-[9px] font-medium uppercase tracking-wide text-gray-300 dark:text-gray-600">em breve</span>}
        </button>
      )
    })}
  </div>
)

export default SubTabSwitcher
