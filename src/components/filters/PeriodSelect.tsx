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

const monthsShort = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

const PeriodSelect = () => {
  const { dataInicial, dataFinal, setPeriodo } = useFilters()

  const [yearStr, monthStr, dayStr] = dataInicial.split('-')
  const [yearEndStr, monthEndStr, dayEndStr] = dataFinal.split('-')
  const selectedYear = yearStr
  const startMonth = Number(monthStr)
  const endMonth = Number(monthEndStr)

  // Check if the range is exactly one calendar month
  const lastDayOfEndMonth = new Date(Number(yearEndStr), endMonth, 0).getDate()
  const isExactMonth =
    yearStr === yearEndStr &&
    monthStr === monthEndStr &&
    dayStr === '01' &&
    Number(dayEndStr) === lastDayOfEndMonth

  const isMultiMonth =
    !isExactMonth &&
    (yearStr !== yearEndStr || monthStr !== monthEndStr)

  const selectedMonth = isExactMonth ? String(startMonth) : 'custom'

  const handleYearChange = (year: string) => {
    const m = monthStr
    const firstDay = `${year}-${m}-01`
    const lastDay = new Date(Number(year), Number(m), 0)
    const lastDayStr = `${year}-${m}-${String(lastDay.getDate()).padStart(2, '0')}`
    setPeriodo(firstDay, lastDayStr)
  }

  const handleMonthChange = (month: string) => {
    if (month === 'custom') return
    const m = month.padStart(2, '0')
    const firstDay = `${selectedYear}-${m}-01`
    const lastDay = new Date(Number(selectedYear), Number(month), 0)
    const lastDayStr = `${selectedYear}-${m}-${String(lastDay.getDate()).padStart(2, '0')}`
    setPeriodo(firstDay, lastDayStr)
  }

  const customLabel = isMultiMonth
    ? `${monthsShort[startMonth - 1]} - ${monthsShort[endMonth - 1]}`
    : 'Personalizado'

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
          <SelectValue>
            {selectedMonth === 'custom' ? customLabel : months[startMonth - 1]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {!isExactMonth && (
            <SelectItem value="custom" disabled className="text-xs italic opacity-50">
              {customLabel}
            </SelectItem>
          )}
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
