import { useQuery } from '@tanstack/react-query'
import CompanySelect from '@/components/filters/CompanySelect'
import PeriodSelect from '@/components/filters/PeriodSelect'
import DateRangePicker from '@/components/filters/DateRangePicker'
import { Separator } from '@/components/ui/separator'
import { useFilters } from '@/hooks/useFilters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { cn } from '@/lib/utils'

const GlobalFilterBar = () => {
  const { dataInicial, dataFinal } = useFilters()

  // Detecta single-posto user — pra esconder o CompanySelect (que vira ruído
  // já que não há o que escolher). Dashboard tem toggle; outros módulos
  // já auto-selecionam o único posto.
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const showCompanySelect = empresasPermitidas.length !== 1

  // Detect if current range is an exact calendar month (PeriodSelect mode)
  const [yearStr, monthStr, dayStr] = dataInicial.split('-')
  const [yearEndStr, monthEndStr, dayEndStr] = dataFinal.split('-')
  const lastDayOfMonth = new Date(Number(yearEndStr), Number(monthEndStr), 0).getDate()
  const isPeriodMode =
    yearStr === yearEndStr &&
    monthStr === monthEndStr &&
    dayStr === '01' &&
    Number(dayEndStr) === lastDayOfMonth

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showCompanySelect && (
        <>
          <CompanySelect />
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
        </>
      )}

      {/* Period selector */}
      <div className={cn(
        'flex flex-col gap-0.5 transition-opacity',
        !isPeriodMode && 'opacity-50'
      )}>
        <PeriodSelect />
      </div>

      <Separator orientation="vertical" className="hidden h-6 sm:block" />

      {/* Date range picker */}
      <div className={cn(
        'flex flex-col gap-0.5 transition-opacity',
        isPeriodMode && 'opacity-50'
      )}>
        {!isPeriodMode && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-500">Período ativo</span>
        )}
        <DateRangePicker />
      </div>
    </div>
  )
}

export default GlobalFilterBar
