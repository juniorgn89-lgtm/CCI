import { lazy, Suspense } from 'react'
import { Wallet } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const CaixaPosto = lazy(() => import('@/pages/Operacao/components/CaixaPosto'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/**
 * Página Caixas & Turnos — só header + DateRangeToolbar; KPIs, gráficos e
 * tabelas vivem dentro do CaixaPosto (que tem suas próprias tabs).
 */
const CaixasTurnos = () => {
  const {
    kpis,
    caixaResumo,
    pagamentoBreakdown,
    turnoGroups,
    apuradoPorDia,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()
  const empresaNome = useEmpresaNome()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/30">
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Caixas &amp; Turnos{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Apuração, fechamentos, pagamentos e turnos
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        showSkeleton ? (
          <TabFallback />
        ) : (
          <Suspense fallback={<TabFallback />}>
            <CaixaPosto
              kpis={kpis}
              caixaResumo={caixaResumo}
              pagamentoBreakdown={pagamentoBreakdown}
              turnoGroups={turnoGroups}
              apuradoPorDia={apuradoPorDia}
            />
          </Suspense>
        )
      )}
    </div>
  )
}

export default CaixasTurnos
