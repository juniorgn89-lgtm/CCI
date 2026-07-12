import { useMemo } from 'react'
import { ChevronDown, Info, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { todayLocal } from '@/lib/period'
import { useFilterStore } from '@/store/filters'

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const pad = (n: number) => String(n).padStart(2, '0')
const isoMinusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

type PresetKey = 'hoje' | 'ontem' | '7dias' | 'mes' | 'mesPassado'
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: '7dias', label: 'Últimos 7 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mesPassado', label: 'Mês passado' },
]
const PRESET_LABEL: Record<PresetKey, string> = Object.fromEntries(PRESETS.map((p) => [p.key, p.label])) as Record<PresetKey, string>

/**
 * Range de cada preset. "Este mês" respeita o flag "Dias fechados": marcado →
 * termina em ONTEM (só dias apurados); desmarcado → inclui HOJE. Os demais são
 * fixos ("7 dias"/"Ontem" já param em ontem; só "Hoje" é ao vivo).
 */
const computePreset = (key: PresetKey, diasFechados: boolean): { ini: string; fim: string } => {
  const hoje = todayLocal()
  const [y, m] = hoje.split('-').map(Number)
  const ontem = isoMinusDays(hoje, 1)
  const firstM = `${y}-${pad(m)}-01`
  switch (key) {
    case 'hoje': return { ini: hoje, fim: hoje }
    case 'ontem': return { ini: ontem, fim: ontem }
    case '7dias': return { ini: isoMinusDays(hoje, 7), fim: ontem }
    case 'mes': {
      const fimFechado = ontem >= firstM ? ontem : firstM
      return { ini: firstM, fim: diasFechados ? fimFechado : hoje }
    }
    case 'mesPassado': {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      const last = new Date(py, pm, 0).getDate()
      return { ini: `${py}-${pad(pm)}-01`, fim: `${py}-${pad(pm)}-${pad(last)}` }
    }
  }
}
const activePreset = (ini: string, fim: string, diasFechados: boolean): PresetKey | null => {
  for (const { key } of PRESETS) {
    const r = computePreset(key, diasFechados)
    if (r.ini === ini && r.fim === fim) return key
  }
  return null
}

interface PeriodPresetSelectProps {
  /** Período atual (rascunho) — yyyy-MM-dd. Dirige o highlight do preset/meses. */
  dataInicial: string
  dataFinal: string
  /** Preset escolhido → aplica NA HORA (commit ao store). */
  onApply: (dataInicial: string, dataFinal: string) => void
  /** Meses (Personalizado) → preenche o rascunho (segue com Visualizar). */
  onCustomChange: (dataInicial: string, dataFinal: string) => void
}

/**
 * Seletor de período: atalhos rápidos (Hoje/Ontem/7 dias/Este mês/Mês passado)
 * que aplicam na hora + "Personalizado" com a grade de meses (preenche o
 * rascunho). Substitui o MonthRangeSelect.
 */
const PeriodPresetSelect = ({ dataInicial, dataFinal, onApply, onCustomChange }: PeriodPresetSelectProps) => {
  const diasFechados = useFilterStore((s) => s.diasFechados)
  const setDiasFechados = useFilterStore((s) => s.setDiasFechados)
  const active = activePreset(dataInicial, dataFinal, diasFechados)
  const year = dataInicial ? Number(dataInicial.slice(0, 4)) : new Date().getFullYear()

  // Liga/desliga "Dias fechados". Se o período atual for o MÊS CORRENTE (até
  // hoje ou ontem), re-aplica na hora com o novo fim. Fora do mês corrente só
  // guarda a preferência (vale na próxima vez que usar "Este mês").
  const toggleDiasFechados = () => {
    const next = !diasFechados
    setDiasFechados(next)
    const hoje = todayLocal()
    const [y, m] = hoje.split('-').map(Number)
    const firstM = `${y}-${pad(m)}-01`
    const ontem = isoMinusDays(hoje, 1)
    const fimFechado = ontem >= firstM ? ontem : firstM
    if (dataInicial === firstM && (dataFinal === hoje || dataFinal === fimFechado)) {
      onApply(firstM, next ? fimFechado : hoje)
    }
  }

  // Meses 100% contidos no range (só quando cobre meses inteiros) — p/ o custom.
  const selectedMonths = useMemo<number[]>(() => {
    if (!dataInicial || !dataFinal) return []
    const [yi, mi, di] = dataInicial.split('-').map(Number)
    const [yf, mf, df] = dataFinal.split('-').map(Number)
    if (yi !== year || yf !== year || di !== 1) return []
    if (df !== new Date(yf, mf, 0).getDate()) return []
    const out: number[] = []
    for (let m = mi; m <= mf; m++) out.push(m)
    return out
  }, [dataInicial, dataFinal, year])

  const toggleMonth = (m: number) => {
    const next = selectedMonths.includes(m)
      ? selectedMonths.filter((x) => x !== m)
      : [...selectedMonths, m].sort((a, b) => a - b)
    if (next.length === 0) return
    const minM = next[0], maxM = next[next.length - 1]
    onCustomChange(`${year}-${pad(minM)}-01`, `${year}-${pad(maxM)}-${pad(new Date(year, maxM, 0).getDate())}`)
  }
  const hasGap = selectedMonths.length > 1 && (selectedMonths[selectedMonths.length - 1] - selectedMonths[0] + 1) !== selectedMonths.length

  const triggerLabel = active
    ? PRESET_LABEL[active]
    : selectedMonths.length === 1
      ? months[selectedMonths[0] - 1]
      : selectedMonths.length > 1
        ? `${monthsShort[selectedMonths[0] - 1]} - ${monthsShort[selectedMonths[selectedMonths.length - 1] - 1]}`
        : 'Personalizado'

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
      <DropdownMenuContent align="start" className="w-[240px]">
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.key}
            onSelect={() => { const r = computePreset(p.key, diasFechados); onApply(r.ini, r.fim) }}
            className="gap-2 text-xs"
          >
            <Check className={cn('h-3.5 w-3.5', active === p.key ? 'opacity-100 text-[#2563eb]' : 'opacity-0')} />
            {p.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {/* Flag "Dias fechados" — no mês corrente, termina em ontem (apurado) em
            vez de hoje (em andamento). */}
        <DropdownMenuCheckboxItem
          checked={diasFechados}
          onCheckedChange={toggleDiasFechados}
          onSelect={(e) => e.preventDefault()}
          className="text-xs"
        >
          <span className="flex flex-col">
            <span>Dias fechados</span>
            <span className="text-[10px] text-gray-400">Mês corrente termina em ontem (apurado)</span>
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="text-xs">Personalizado · meses</span>
          <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200">{year}</span>
        </DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-0.5 p-1">
          {monthsShort.map((label, i) => (
            <DropdownMenuCheckboxItem
              key={i}
              checked={selectedMonths.includes(i + 1)}
              onCheckedChange={() => toggleMonth(i + 1)}
              onSelect={(e) => e.preventDefault()}
              className="justify-center px-2 text-xs"
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
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

export default PeriodPresetSelect
