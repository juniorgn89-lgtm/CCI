import { useFilters } from '@/hooks/useFilters'
import { Input } from '@/components/ui/input'

const DateRangePicker = () => {
  const { dataInicial, dataFinal, setPeriodo } = useFilters()

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={dataInicial}
        onChange={(e) => setPeriodo(e.target.value, dataFinal)}
        className="h-9 w-[150px] border-gray-300 bg-white text-sm dark:border-gray-600 dark:bg-gray-900"
        aria-label="Data inicial"
      />
      <span className="text-sm text-gray-400">—</span>
      <Input
        type="date"
        value={dataFinal}
        onChange={(e) => setPeriodo(dataInicial, e.target.value)}
        className="h-9 w-[150px] border-gray-300 bg-white text-sm dark:border-gray-600 dark:bg-gray-900"
        aria-label="Data final"
      />
    </div>
  )
}

export default DateRangePicker
