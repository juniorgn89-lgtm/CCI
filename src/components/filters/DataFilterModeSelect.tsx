import { Activity, CheckCircle2, Layers } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'

/* ─── Helpers de datas ─── */

const pad = (n: number) => String(n).padStart(2, '0')

const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const todayParts = () => {
  const d = new Date()
  return { iso: fmtDate(d), year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

/** yyyy-MM-01 do mês corrente. */
const firstOfCurrentMonth = (): string => {
  const t = todayParts()
  return `${t.year}-${pad(t.month)}-01`
}

/** yyyy-MM-{ultimoDia} do mês corrente. */
const lastOfCurrentMonth = (): string => {
  const t = todayParts()
  const last = new Date(t.year, t.month, 0).getDate()
  return `${t.year}-${pad(t.month)}-${pad(last)}`
}

/** yyyy-MM-dd de ontem (string). Se hoje é dia 1, retorna primeiro do mês mesmo. */
const yesterdayOrFirst = (): string => {
  const t = todayParts()
  if (t.day <= 1) return firstOfCurrentMonth()
  const y = new Date(t.year, t.month - 1, t.day - 1)
  return fmtDate(y)
}

/* ─── Componente ─── */

type Mode = 'em_andamento' | 'apurado' | 'completo'

interface Option {
  value: Mode
  label: string
  Icon: typeof Activity
  title: string
}

const options: Option[] = [
  {
    value: 'em_andamento',
    label: 'Em andamento',
    Icon: Activity,
    title: 'Hoje · só dados do dia corrente (sem cache)',
  },
  {
    value: 'apurado',
    label: 'Apurado',
    Icon: CheckCircle2,
    title: 'Só dias já fechados do mês (1º → ontem) — bate no cache, super rápido',
  },
  {
    value: 'completo',
    label: 'Completo',
    Icon: Layers,
    title: 'Mês inteiro (1º → último dia) — apurados + dia corrente',
  },
]

/**
 * Quick-select pra o range de datas: alterna entre "hoje", "mês até ontem"
 * e "mês inteiro". A pill ativa é computada comparando dataInicial/dataFinal
 * com os ranges esperados — então se o user mexer no DateRangePicker e
 * cair fora dos 3 presets, nenhuma pill fica destacada (estado "custom").
 */
const DataFilterModeSelect = () => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const setPeriodo = useFilterStore((s) => s.setPeriodo)

  // Computa qual modo está ativo (se algum) com base nas datas atuais.
  const today = todayParts().iso
  const firstM = firstOfCurrentMonth()
  const lastM = lastOfCurrentMonth()
  const yesterday = yesterdayOrFirst()

  const activeMode: Mode | null =
    dataInicial === today && dataFinal === today
      ? 'em_andamento'
      : dataInicial === firstM && dataFinal === yesterday
        ? 'apurado'
        : dataInicial === firstM && dataFinal === lastM
          ? 'completo'
          : null

  const handleSelect = (mode: Mode) => {
    if (mode === 'em_andamento') {
      setPeriodo(today, today)
    } else if (mode === 'apurado') {
      setPeriodo(firstM, yesterday)
    } else {
      setPeriodo(firstM, lastM)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Escopo dos dados"
      className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800"
    >
      {options.map((opt) => {
        const isActive = activeMode === opt.value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            title={opt.title}
            onClick={() => handleSelect(opt.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
              isActive
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            <opt.Icon className="h-3 w-3" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default DataFilterModeSelect
