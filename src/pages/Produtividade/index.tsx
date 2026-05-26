import { lazy, Suspense, useMemo } from 'react'
import { BarChart3, Users, Zap, Trophy, Fuel } from 'lucide-react'
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
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'

const ProdutividadeTab = lazy(() => import('@/pages/Operacao/components/ProdutividadeTab'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/** Abast/hora ativa — mede utilização durante o expediente real do posto. */
const ritmoPorHoraAtiva = (rows: AbastecimentoRow[]): number => {
  if (rows.length === 0) return 0
  const horasAtivas = new Set<number>()
  for (const a of rows) {
    const h = parseInt(a.dataHora?.substring(11, 13) || '', 10)
    if (!isNaN(h)) horasAtivas.add(h)
  }
  if (horasAtivas.size === 0) return 0
  return rows.length / horasAtivas.size
}

const Produtividade = () => {
  const {
    kpis,
    frentistaRows,
    frentistaRowsPrev,
    abastecimentoRows,
    abastecimentoRowsPrev,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()
  const empresaNome = useEmpresaNome()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  const ritmo = useMemo(() => ritmoPorHoraAtiva(abastecimentoRows), [abastecimentoRows])
  const ritmoPrev = useMemo(() => ritmoPorHoraAtiva(abastecimentoRowsPrev), [abastecimentoRowsPrev])

  const topFrentista = useMemo(() => {
    const ativos = frentistaRows.filter((f) => f.ativo && f.litrosVendidos > 0)
    return ativos.sort((a, b) => b.litrosVendidos - a.litrosVendidos)[0] ?? null
  }, [frentistaRows])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-900/30">
            <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Produtividade{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Performance dos frentistas, ritmo e metas
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
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-amber-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Frentistas Ativos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatNumber(kpis.frentistasAtivos)}
              </p>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">com atendimento no período</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ritmo Operacional</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton ? '—' : `${ritmo.toFixed(1).replace('.', ',')}/h`}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <DeltaBadge current={ritmo} previous={ritmoPrev} />
                <span className="text-[11px] text-gray-400 dark:text-gray-500">abast./hora ativa</span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-cyan-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-cyan-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Abastecimentos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <Fuel className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatNumber(kpis.totalAbastecimentos)}
              </p>
              {kpis && <DeltaBadge current={kpis.totalAbastecimentos} previous={kpis.prevTotalAbastecimentos} />}
            </div>

            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Frentista Destaque</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className={cn(
                'mt-2 truncate text-2xl font-bold tabular-nums',
                topFrentista ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
              )}>
                {showSkeleton || !topFrentista ? '—' : topFrentista.nome}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                {topFrentista ? formatLiters(topFrentista.litrosVendidos) : ''}
              </p>
            </div>
          </div>

          {showSkeleton ? (
            <TabFallback />
          ) : (
            <Suspense fallback={<TabFallback />}>
              <ProdutividadeTab
                frentistaRows={frentistaRows}
                frentistaRowsPrev={frentistaRowsPrev}
                abastecimentoRows={abastecimentoRows}
                abastecimentoRowsPrev={abastecimentoRowsPrev}
                isLoading={isLoading}
              />
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}

export default Produtividade
