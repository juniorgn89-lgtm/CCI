import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PodioPeriodo = 'atual' | 'anterior'

interface Props {
  value: PodioPeriodo
  onChange: (v: PodioPeriodo) => void
  /** Rótulo do mês anterior, ex.: "jul/2026" — mostrado no selo âmbar. */
  mesAnteriorLabel: string
}

const OPTS: { id: PodioPeriodo; label: string }[] = [
  { id: 'atual', label: 'Mês atual' },
  { id: 'anterior', label: 'Mês anterior' },
]

/**
 * Chave "Mês atual | Mês anterior" dos PÓDIOS (segmentado navy, mesma pegada do
 * TopBarTabs) + selo de destaque. Quando "Mês anterior", um pill âmbar deixa
 * explícito que os campeões NÃO são do mês corrente (ex.: "Mês anterior ·
 * jul/2026"). Só os pódios mudam com a chave — KPIs e tabela seguem no filtro.
 */
const PodioPeriodoSwitch = ({ value, onChange, mesAnteriorLabel }: Props) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
      {OPTS.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'h-7 whitespace-nowrap rounded px-2.5 text-xs font-medium transition-all',
              active
                ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-[#14b8a6]'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
    {value === 'anterior' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        <CalendarClock className="h-3 w-3" />
        Mês anterior · {mesAnteriorLabel}
      </span>
    ) : (
      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Mês atual</span>
    )}
  </div>
)

export default PodioPeriodoSwitch
