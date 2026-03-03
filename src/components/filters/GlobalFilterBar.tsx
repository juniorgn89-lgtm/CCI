import CompanySelect from '@/components/filters/CompanySelect'
import PeriodSelect from '@/components/filters/PeriodSelect'
import DateRangePicker from '@/components/filters/DateRangePicker'
import { Separator } from '@/components/ui/separator'

const GlobalFilterBar = () => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CompanySelect />
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <PeriodSelect />
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <DateRangePicker />
    </div>
  )
}

export default GlobalFilterBar
