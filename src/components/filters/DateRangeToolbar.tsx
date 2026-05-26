import { useState } from 'react'
import { CalendarRange, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import MonthRangeSelect from '@/components/filters/MonthRangeSelect'
import { useFilters } from '@/hooks/useFilters'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Período "automático" = bate exatamente com um dos 3 presets do MÊS CORRENTE
 * (Completo / Em andamento / Apurado). Qualquer outra coisa — mês passado,
 * multi-mês, datas digitadas — conta como personalizado.
 *
 * Não confundir com o badge "Apurado" do DataFilterModeSelect: lá um período
 * inteiramente no passado é classificado como "Apurado" (tipo), mas aqui
 * (visual do input) ele é "personalizado" porque foi escolhido pelo usuário.
 */
const isAutoPeriod = (dataInicial: string, dataFinal: string): boolean => {
  const now = new Date()
  const today = fmtDate(now)
  const firstM = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const lastM = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const yesterday = now.getDate() <= 1 ? firstM : fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

  return (
    (dataInicial === firstM && dataFinal === lastM) // Completo
    || (dataInicial === today && dataFinal === today) // Em andamento
    || (dataInicial === firstM && dataFinal === yesterday) // Apurado clássico
  )
}

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
  // Sincroniza draft com o filtro global quando este muda externamente
  // (botão "mês passado", etc.). Padrão "store info from previous renders".
  const [prevIni, setPrevIni] = useState(periodIni)
  const [prevFim, setPrevFim] = useState(periodFim)
  if (prevIni !== periodIni) {
    setPrevIni(periodIni)
    setDraftIni(periodIni)
  }
  if (prevFim !== periodFim) {
    setPrevFim(periodFim)
    setDraftFim(periodFim)
  }
  const dirty = draftIni !== periodIni || draftFim !== periodFim
  const handleVisualizar = () => setPeriodo(draftIni, draftFim)

  // Azul = período automático; laranja = personalizado. Sempre reflete o draft
  // (o que o usuário está vendo nos inputs), não o que está commitado.
  const auto = isAutoPeriod(draftIni, draftFim)
  const inputClass = cn(
    'h-7 w-[120px] text-xs transition-colors',
    auto
      ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
      : 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
  )

  return (
    <div className="flex flex-wrap items-end gap-2">
      <CalendarRange className="mb-1.5 h-3.5 w-3.5 self-end text-gray-400" />
      <div className="flex flex-col gap-0.5">
        <label className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
      <div className="flex flex-col gap-0.5">
        <label className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Inicial
        </label>
        <Input
          type="date"
          value={draftIni}
          onChange={(e) => setDraftIni(e.target.value)}
          className={inputClass}
          aria-label="Data inicial"
        />
      </div>
      <span className="mb-1.5 self-end text-xs text-gray-400">—</span>
      <div className="flex flex-col gap-0.5">
        <label className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Final
        </label>
        <Input
          type="date"
          value={draftFim}
          onChange={(e) => setDraftFim(e.target.value)}
          className={inputClass}
          aria-label="Data final"
        />
      </div>
      <button
        type="button"
        onClick={handleVisualizar}
        disabled={!dirty}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all',
          dirty
            ? 'bg-[#1e3a5f] text-white shadow-sm hover:bg-[#162a44]'
            : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
        )}
      >
        <Eye className="h-3.5 w-3.5" />
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
