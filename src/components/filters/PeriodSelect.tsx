import { useFilters } from '@/hooks/useFilters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

const PeriodSelect = () => {
  const { dataInicial, setPeriodo } = useFilters()

  const [yearStr, monthStr] = dataInicial.split('-')
  const selectedYear = yearStr
  const selectedMonth = String(Number(monthStr))

  const handleYearChange = (year: string) => {
    const month = monthStr
    const firstDay = `${year}-${month}-01`
    const lastDay = new Date(Number(year), Number(month), 0)
    const lastDayStr = `${year}-${month}-${String(lastDay.getDate()).padStart(2, '0')}`
    setPeriodo(firstDay, lastDayStr)
  }

  const handleMonthChange = (month: string) => {
    const m = month.padStart(2, '0')
    const firstDay = `${selectedYear}-${m}-01`
    const lastDay = new Date(Number(selectedYear), Number(month), 0)
    const lastDayStr = `${selectedYear}-${m}-${String(lastDay.getDate()).padStart(2, '0')}`
    setPeriodo(firstDay, lastDayStr)
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedYear} onValueChange={handleYearChange}>
        <SelectTrigger className="h-9 w-[90px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedMonth} onValueChange={handleMonthChange}>
        <SelectTrigger className="h-9 w-[130px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((label, i) => (
            <SelectItem key={i + 1} value={(i + 1).toString()}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default PeriodSelect
