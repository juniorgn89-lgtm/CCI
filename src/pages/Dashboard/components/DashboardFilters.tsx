import { useMemo } from 'react'
import { Filter } from 'lucide-react'
import { useFilters } from '@/hooks/useFilters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const DashboardFilters = () => {
  const { dataInicial, dataFinal, setPeriodo } = useFilters()

  const parsed = useMemo(() => {
    const [y, m, d1] = dataInicial.split('-').map(Number)
    const d2 = Number(dataFinal.split('-')[2])
    return { year: y, month: m, dayStart: d1, dayEnd: d2 }
  }, [dataInicial, dataFinal])

  const daysInMonth = new Date(parsed.year, parsed.month, 0).getDate()

  const updatePeriod = (year: number, month: number, dayStart: number, dayEnd: number) => {
    const maxDay = new Date(year, month, 0).getDate()
    const d1 = Math.min(dayStart, maxDay)
    const d2 = Math.min(dayEnd, maxDay)
    const pad = (n: number) => String(n).padStart(2, '0')
    setPeriodo(`${year}-${pad(month)}-${pad(d1)}`, `${year}-${pad(month)}-${pad(d2)}`)
  }

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - i)
  }, [])

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Filter className="h-4 w-4" />
        Filtros
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Ano</span>
        <Select
          value={String(parsed.year)}
          onValueChange={(v) => updatePeriod(Number(v), parsed.month, parsed.dayStart, parsed.dayEnd)}
        >
          <SelectTrigger className="h-8 w-[90px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Mês</span>
        <Select
          value={String(parsed.month)}
          onValueChange={(v) => updatePeriod(parsed.year, Number(v), parsed.dayStart, parsed.dayEnd)}
        >
          <SelectTrigger className="h-8 w-[130px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Intervalo</span>
        <Input
          type="number"
          min={1}
          max={daysInMonth}
          value={parsed.dayStart}
          onChange={(e) => updatePeriod(parsed.year, parsed.month, Number(e.target.value) || 1, parsed.dayEnd)}
          className="h-8 w-[60px] text-center text-sm"
        />
        <Input
          type="number"
          min={1}
          max={daysInMonth}
          value={parsed.dayEnd}
          onChange={(e) => updatePeriod(parsed.year, parsed.month, parsed.dayStart, Number(e.target.value) || 1)}
          className="h-8 w-[60px] text-center text-sm"
        />
      </div>
    </div>
  )
}

export default DashboardFilters
