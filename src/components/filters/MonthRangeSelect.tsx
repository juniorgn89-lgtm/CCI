import { useMemo } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const monthsShort = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const pad = (n: number) => String(n).padStart(2, '0')

interface MonthRangeSelectProps {
  /** Data inicial atual (yyyy-MM-dd). */
  draftIni: string
  /** Data final atual (yyyy-MM-dd). */
  draftFim: string
  /** Callback ao selecionar meses — emite novo range yyyy-MM-dd. */
  onChange: (dataInicial: string, dataFinal: string) => void
}

/**
 * Multi-select de meses. Calcula o range como min..max dos meses marcados —
 * meses entre dois marcados ficam incluídos no range mesmo que não tenham
 * sido clicados (a API só aceita range contínuo). Um aviso visual sinaliza
 * isso quando o usuário pula meses.
 */
const MonthRangeSelect = ({ draftIni, draftFim, onChange }: MonthRangeSelectProps) => {
  // Ano do painel: deriva direto da draftIni (controlado pelo seletor de ano da
  // barra). Não há navegação de ano aqui — evita controle duplicado/confuso.
  const year = draftIni ? Number(draftIni.slice(0, 4)) : new Date().getFullYear()

  // Meses selecionados = aqueles cujo intervalo [dia 1, último dia] está
  // 100% contido no draft. Só funciona se o draft cobre meses inteiros.
  const selectedMonths = useMemo<number[]>(() => {
    if (!draftIni || !draftFim) return []
    const [yi, mi, di] = draftIni.split('-').map(Number)
    const [yf, mf, df] = draftFim.split('-').map(Number)
    if (yi !== year || yf !== year) return []
    if (di !== 1) return []
    const lastDayFm = new Date(yf, mf, 0).getDate()
    if (df !== lastDayFm) return []
    const out: number[] = []
    for (let m = mi; m <= mf; m++) out.push(m)
    return out
  }, [draftIni, draftFim, year])

  const toggleMonth = (m: number) => {
    const isSelected = selectedMonths.includes(m)
    const next = isSelected
      ? selectedMonths.filter((x) => x !== m)
      : [...selectedMonths, m].sort((a, b) => a - b)
    if (next.length === 0) return
    const minM = next[0]
    const maxM = next[next.length - 1]
    const firstDay = `${year}-${pad(minM)}-01`
    const lastDay = new Date(year, maxM, 0)
    const lastDayStr = `${year}-${pad(maxM)}-${pad(lastDay.getDate())}`
    onChange(firstDay, lastDayStr)
  }

  const triggerLabel = (() => {
    if (selectedMonths.length === 0) return 'Personalizado'
    if (selectedMonths.length === 1) return months[selectedMonths[0] - 1]
    const min = selectedMonths[0]
    const max = selectedMonths[selectedMonths.length - 1]
    return `${monthsShort[min - 1]} - ${monthsShort[max - 1]}`
  })()

  // Há "gaps" se os meses selecionados não são contínuos.
  const hasGap = selectedMonths.length > 1 && (selectedMonths[selectedMonths.length - 1] - selectedMonths[0] + 1) !== selectedMonths.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 min-w-[124px] items-center justify-between gap-1.5 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
            'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px]">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="text-xs">Selecionar meses</span>
          <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {year}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-3 gap-0.5 p-1">
          {monthsShort.map((label, i) => {
            const m = i + 1
            const checked = selectedMonths.includes(m)
            return (
              <DropdownMenuCheckboxItem
                key={m}
                checked={checked}
                onCheckedChange={() => toggleMonth(m)}
                onSelect={(e) => e.preventDefault()}
                className="justify-center px-2 text-xs"
              >
                {label}
              </DropdownMenuCheckboxItem>
            )
          })}
        </div>
        {hasGap && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-start gap-1.5 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>Meses entre os selecionados também entram no período.</span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default MonthRangeSelect
