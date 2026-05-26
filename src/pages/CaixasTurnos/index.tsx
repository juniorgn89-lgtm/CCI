import { lazy, Suspense } from 'react'
import { Wallet, Scale, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const CaixaPosto = lazy(() => import('@/pages/Operacao/components/CaixaPosto'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

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
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Apurado</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatCurrency(kpis.totalApurado)}
              </p>
              {kpis && <DeltaBadge current={kpis.totalApurado} previous={kpis.prevTotalApurado} />}
            </div>

            <div className={cn(
              'rounded-xl border p-5 shadow-sm',
              kpis && kpis.totalDiferenca < 0
                ? 'border-red-200 bg-gradient-to-br from-red-50/60 to-white dark:border-red-900/50 dark:from-red-950/20 dark:to-gray-900'
                : kpis && kpis.totalDiferenca > 0
                ? 'border-amber-200 bg-gradient-to-br from-amber-50/60 to-white dark:border-amber-900/50 dark:from-amber-950/20 dark:to-gray-900'
                : 'border-gray-200 bg-gradient-to-br from-gray-50/60 to-white dark:border-gray-700 dark:from-gray-800/40 dark:to-gray-900'
            )}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Diferença de Caixa</p>
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  kpis && kpis.totalDiferenca < 0
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : kpis && kpis.totalDiferenca > 0
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-gray-100 dark:bg-gray-800'
                )}>
                  <Scale className={cn(
                    'h-5 w-5',
                    kpis && kpis.totalDiferenca < 0
                      ? 'text-red-600 dark:text-red-400'
                      : kpis && kpis.totalDiferenca > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400'
                  )} />
                </div>
              </div>
              <p className={cn(
                'mt-2 text-2xl font-bold tabular-nums',
                kpis && kpis.totalDiferenca < 0
                  ? 'text-red-600 dark:text-red-400'
                  : kpis && kpis.totalDiferenca > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-900 dark:text-gray-100'
              )}>
                {showSkeleton || !kpis ? '—' : `${kpis.totalDiferenca > 0 ? '+' : ''}${formatCurrency(kpis.totalDiferenca)}`}
              </p>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                {kpis && kpis.totalDiferenca < 0 ? 'Falta acumulada' : kpis && kpis.totalDiferenca > 0 ? 'Sobra acumulada' : 'Caixas fechados'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-orange-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Caixas Abertos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton ? '—' : formatNumber(caixaResumo.caixasAbertos)}
              </p>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">pendentes de fechamento</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-green-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Caixas Fechados</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton ? '—' : formatNumber(caixaResumo.caixasFechados)}
              </p>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">conferidos no período</p>
            </div>
          </div>

          {showSkeleton ? (
            <TabFallback />
          ) : (
            <Suspense fallback={<TabFallback />}>
              <CaixaPosto
                caixaResumo={caixaResumo}
                pagamentoBreakdown={pagamentoBreakdown}
                turnoGroups={turnoGroups}
                apuradoPorDia={apuradoPorDia}
              />
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}

export default CaixasTurnos
