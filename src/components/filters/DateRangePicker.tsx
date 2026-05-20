import { useFilters } from '@/hooks/useFilters'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * "Automático" = o range é um dos períodos relativos a hoje (mês corrente
 * completo / Em andamento / Apurado). Qualquer outro período — mês passado
 * escolhido no seletor ou datas digitadas à mão — conta como personalizado.
 */
const isAutoPeriod = (dataInicial: string, dataFinal: string): boolean => {
  const now = new Date()
  const today = fmtDate(now)
  const firstM = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const lastM = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const yesterday = now.getDate() <= 1 ? firstM : fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

  return (
    (dataInicial === firstM && dataFinal === lastM) || // mês corrente completo (default / Completo)
    (dataInicial === today && dataFinal === today) || // Em andamento
    (dataInicial === firstM && dataFinal === yesterday) // Apurado
  )
}

const DateRangePicker = () => {
  const { dataInicial, dataFinal, setPeriodo } = useFilters()

  // Azul claro = período automático (corrente); laranja claro = personalizado.
  const auto = isAutoPeriod(dataInicial, dataFinal)
  const fieldClass = cn(
    'h-9 w-[150px] text-sm transition-colors',
    auto
      ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
      : 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
  )

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={dataInicial}
        onChange={(e) => setPeriodo(e.target.value, dataFinal)}
        className={fieldClass}
        aria-label="Data inicial"
      />
      <span className="text-sm text-gray-400">—</span>
      <Input
        type="date"
        value={dataFinal}
        onChange={(e) => setPeriodo(dataInicial, e.target.value)}
        className={fieldClass}
        aria-label="Data final"
      />
    </div>
  )
}

export default DateRangePicker
