import { useEffect, useState } from 'react'
import { CalendarRange, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import MonthRangeSelect from '@/components/filters/MonthRangeSelect'
import { useFilters } from '@/hooks/useFilters'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'

/**
 * Toolbar de filtro de período pra ser portada via <PageHeaderActions> em cada
 * página. Estado local (draft) — só "commita" pro filtro global ao clicar
 * Visualizar (que invalida queries e dispara o refetch). Sincroniza com a
 * store global quando ela é alterada por fora (ex: troca de página).
 */
const DateRangeToolbar = () => {
  const periodIni = useFilterStore((s) => s.dataInicial)
  const periodFim = useFilterStore((s) => s.dataFinal)
  const { setPeriodo } = useFilters()

  const [draftIni, setDraftIni] = useState(periodIni)
  const [draftFim, setDraftFim] = useState(periodFim)
  useEffect(() => {
    setDraftIni(periodIni)
    setDraftFim(periodFim)
  }, [periodIni, periodFim])
  const dirty = draftIni !== periodIni || draftFim !== periodFim
  const handleVisualizar = () => setPeriodo(draftIni, draftFim)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2 self-center">
        <CalendarRange className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Período
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Mês
        </label>
        <MonthRangeSelect
          draftIni={draftIni}
          draftFim={draftFim}
          onChange={(ini, fim) => {
            setDraftIni(ini)
            setDraftFim(fim)
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Inicial
        </label>
        <Input
          type="date"
          value={draftIni}
          onChange={(e) => setDraftIni(e.target.value)}
          className={cn(
            'h-9 w-[150px] text-sm transition-colors',
            dirty && 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
          )}
          aria-label="Data inicial"
        />
      </div>
      <span className="mb-2 self-end text-gray-400">—</span>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Final
        </label>
        <Input
          type="date"
          value={draftFim}
          onChange={(e) => setDraftFim(e.target.value)}
          className={cn(
            'h-9 w-[150px] text-sm transition-colors',
            dirty && 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
          )}
          aria-label="Data final"
        />
      </div>
      <button
        type="button"
        onClick={handleVisualizar}
        disabled={!dirty}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-all',
          dirty
            ? 'bg-[#1e3a5f] text-white shadow-sm hover:bg-[#162a44]'
            : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
        )}
      >
        <Eye className="h-4 w-4" />
        Visualizar
      </button>
      {dirty && (
        <span className="self-center text-[11px] text-orange-600 dark:text-orange-400">
          Alterações não aplicadas
        </span>
      )}
    </div>
  )
}

export default DateRangeToolbar
