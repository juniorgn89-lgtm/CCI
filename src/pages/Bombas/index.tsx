import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gauge, Trophy, Droplets, Activity } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { cn } from '@/lib/utils'
import { formatLiters, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import BombaMobile from '@/pages/Bombas/BombaMobile'
import AfericoesCard from '@/pages/QualidadeDados/components/AfericoesCard'

const ControleBombas = lazy(() => import('@/pages/Operacao/components/ControleBombas'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

const Bombas = ({ embedded = false }: { embedded?: boolean } = {}) => {
  // Bomba é físico por-posto (precisão centavo → segue live). Mostra UM posto por
  // vez, com seletor quando o filtro tem mais de um (Todos/subconjunto).
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  const { kpis, bombaRows, bombaRowsPrev, isLoading, hasEmpresa } = useOperacaoData(selectedCodigo)
  // Aferições do posto (afericao=true) — saída física de teste de bomba.
  const { afericoes, isLoading: afLoading } = useAbastecimentosAnalytics(selectedCodigo)
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const isMobile = useIsMobile()

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

  // Mobile: tela própria. Embedded (dentro de Operação) roda só no desktop — o
  // mobile é servido pelo OperacaoMobile.
  if (!embedded && isMobile) return <BombaMobile />

  return (
    <div className="space-y-6">
      {!embedded && (
        <>
          <PageHeaderTitle placement="header">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
              <FocusModeToggle />
            </div>
          </PageHeaderTitle>
          <PageHeaderActions>
            <DateRangeToolbar />
          </PageHeaderActions>
        </>
      )}

      {/* Seletor de posto — só quando o filtro tem mais de um (Todos/subconjunto). */}
      {postos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {postos.map((e) => (
            <button
              key={e.codigo}
              type="button"
              onClick={() => setActiveCodigo(e.codigo)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                e.codigo === selectedCodigo
                  ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                  : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
              )}
            >
              {e.fantasia}
            </button>
          ))}
        </div>
      )}

      {postos.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          Nenhum posto disponível.
        </p>
      )}

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
              <ControleBombas bombaRows={bombaRows} bombaRowsPrev={bombaRowsPrev} empresaCodigo={selectedCodigo} />
            </Suspense>
          )}

          {/* Aferições — combustível de teste (INMETRO) saindo da bomba: quando e
              quanto, por frentista/dia, com detalhe em modal. */}
          <AfericoesCard rows={afericoes} isLoading={afLoading} />
        </>
      )}
    </div>
  )
}

export default Bombas
