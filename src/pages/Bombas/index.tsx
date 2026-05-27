import { lazy, Suspense, useMemo } from 'react'
import { Gauge, Trophy, Droplets, Activity } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { cn } from '@/lib/utils'
import { formatLiters, formatNumber } from '@/lib/formatters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const ControleBombas = lazy(() => import('@/pages/Operacao/components/ControleBombas'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

const Bombas = () => {
  const { kpis, bombaRows, bombaRowsPrev, isLoading, hasEmpresa } = useOperacaoData()
  const empresaNome = useEmpresaNome()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  const stats = useMemo(() => {
    const ativas = bombaRows.filter((b) => b.abastecimentos > 0)
    const ordenadas = [...ativas].sort((a, b) => b.litrosVendidos - a.litrosVendidos)
    const top = ordenadas[0] ?? null
    const totalLitros = ativas.reduce((s, b) => s + b.litrosVendidos, 0)
    const totalAbast = ativas.reduce((s, b) => s + b.abastecimentos, 0)
    const totalLitrosPrev = bombaRowsPrev.reduce((s, b) => s + b.litrosVendidos, 0)
    const totalAbastPrev = bombaRowsPrev.reduce((s, b) => s + b.abastecimentos, 0)
    return { top, totalLitros, totalAbast, totalLitrosPrev, totalAbastPrev }
  }, [bombaRows, bombaRowsPrev])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
            <Gauge className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Bombas{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Volume bombeado, ranking e manutenção
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
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-indigo-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Bombas Ativas</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <Gauge className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatNumber(kpis.bombasAtivas)}
              </p>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">com movimento no período</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Litros Bombeados</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton ? '—' : formatLiters(stats.totalLitros)}
              </p>
              <DeltaBadge current={stats.totalLitros} previous={stats.totalLitrosPrev} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-cyan-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-cyan-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Abastecimentos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton ? '—' : formatNumber(stats.totalAbast)}
              </p>
              <DeltaBadge current={stats.totalAbast} previous={stats.totalAbastPrev} />
            </div>

            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Bomba +Usada</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className={cn(
                'mt-2 truncate text-2xl font-bold tabular-nums',
                stats.top ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
              )}>
                {showSkeleton || !stats.top ? '—' : (stats.top.descricao || `Bomba ${stats.top.bombaCodigo}`)}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                {stats.top ? formatLiters(stats.top.litrosVendidos) : ''}
              </p>
            </div>
          </div>

          {showSkeleton ? (
            <TabFallback />
          ) : (
            <Suspense fallback={<TabFallback />}>
              <ControleBombas bombaRows={bombaRows} bombaRowsPrev={bombaRowsPrev} />
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}

export default Bombas
