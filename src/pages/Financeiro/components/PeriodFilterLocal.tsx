import { Infinity as InfinityIcon, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LocalPeriod {
  /** Quando true, ignora as datas e considera TUDO em aberto (snapshot completo). */
  allPeriod: boolean
  dataInicial: string
  dataFinal: string
}

interface Props {
  value: LocalPeriod
  onChange: (next: LocalPeriod) => void
  /** Rótulo do campo de data (opcional). Default: "Por data de movimento". */
  label?: string
  className?: string
}

/**
 * Filtro de período LOCAL (não mexe no filtro global) + toggle "Todo o período".
 * Usado na Visão Geral, Receber, Pagar e Cartões pra alternar entre um recorte por
 * data e o snapshot completo do que está em aberto. Quando "Todo o período" está
 * ligado, os campos de data ficam desabilitados e o filtro de data é ignorado.
 */
const PeriodFilterLocal = ({ value, onChange, label = 'Por data de movimento', className }: Props) => {
  const { allPeriod, dataInicial, dataFinal } = value

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
        <button
          type="button"
          onClick={() => onChange({ ...value, allPeriod: true })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            allPeriod
              ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
          aria-pressed={allPeriod}
        >
          <InfinityIcon className="h-3.5 w-3.5" />
          Todo o período
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, allPeriod: false })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            !allPeriod
              ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
          aria-pressed={!allPeriod}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          Por data
        </button>
      </div>

      <div className={cn('flex items-center gap-1.5', allPeriod && 'opacity-50')} title={label}>
        <input
          type="date"
          value={dataInicial}
          disabled={allPeriod}
          onChange={(e) => onChange({ ...value, dataInicial: e.target.value })}
          className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200"
          aria-label="Data inicial"
        />
        <span className="text-xs text-gray-400">—</span>
        <input
          type="date"
          value={dataFinal}
          disabled={allPeriod}
          onChange={(e) => onChange({ ...value, dataFinal: e.target.value })}
          className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200"
          aria-label="Data final"
        />
      </div>
    </div>
  )
}

export default PeriodFilterLocal
