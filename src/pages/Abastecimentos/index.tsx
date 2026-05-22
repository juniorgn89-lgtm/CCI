import { lazy, Suspense, useMemo } from 'react'
import { Fuel, Droplets, DollarSign, Receipt, LineChart, Info, TrendingUp, TrendingDown } from 'lucide-react'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import RouteFallback from '@/components/feedback/RouteFallback'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import { smoothedProjection } from '@/lib/projection'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const AbastecimentosTab = lazy(() => import('@/pages/Operacao/components/AbastecimentosTab'))

/**
 * Abastecimentos — módulo dedicado ao drill-down transacional das vendas de
 * combustível. KPIs principais no topo (mesma fonte de dados de Operação,
 * cache compartilhada via TanStack Query). Sub-abas (Diária, Por tipo,
 * L.B./Litro) vivem dentro do componente AbastecimentosTab.
 */
const Abastecimentos = () => {
  const { empresaCodigos, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()
  const { kpis, isLoading } = useOperacaoData()
  const { dailyData, projectionMeta } = useAbastecimentosAnalytics()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  // Projeção de faturamento: extrapola pelos dias que faltam usando média
  // móvel suavizada do período (mesmo helper do Dashboard e Conveniências).
  // Em períodos sem dias futuros (Apurado/Em andamento) a projeção = realizado
  // — sinalizamos isso na UI com info badge.
  const projecao = useMemo(() => {
    if (!kpis) return { faturamento: 0, comparativo: 0, variacao: 0, isProjetada: false }
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const { projetado } = smoothedProjection({
      realizado: kpis.faturamentoCombustivel,
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.faturamento })),
      diasRestantes: projectionMeta.daysRemaining,
      today: todayISO,
    })
    const prev = kpis.prevFaturamentoCombustivel
    return {
      faturamento: projetado,
      comparativo: prev,
      variacao: prev > 0 ? ((projetado - prev) / prev) * 100 : 0,
      isProjetada: projectionMeta.daysRemaining > 0,
    }
  }, [kpis, dailyData, projectionMeta.daysRemaining, dataFinal])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/30">
            <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Abastecimentos{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Drill-down de cada venda de combustível — por dia, tipo e L.B./Litro
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
          {/* KPIs principais — sempre visíveis acima das sub-abas */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Abastecimentos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Fuel className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatNumber(kpis.totalAbastecimentos)}
              </p>
              {kpis && <DeltaBadge current={kpis.totalAbastecimentos} previous={kpis.prevTotalAbastecimentos} />}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-cyan-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-cyan-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Litros Vendidos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <Droplets className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatLiters(kpis.totalLitros)}
              </p>
              {kpis && <DeltaBadge current={kpis.totalLitros} previous={kpis.prevTotalLitros} />}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Faturamento</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatCurrency(kpis.faturamentoCombustivel)}
              </p>
              {kpis && <DeltaBadge current={kpis.faturamentoCombustivel} previous={kpis.prevFaturamentoCombustivel} />}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-purple-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ticket Médio</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Receipt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatCurrency(kpis.ticketMedio)}
              </p>
              {kpis && <DeltaBadge current={kpis.ticketMedio} previous={kpis.prevTicketMedio} />}
            </div>

            {/* Projeção de faturamento — card preenchido (azul). Quando o período
                não tem dias futuros, o valor não é projeção real: riscamos e
                avisamos com o info badge (igual ao card de Conveniências). */}
            <div className="rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/90">Projeção</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                  <LineChart className="h-5 w-5 text-white" />
                </div>
              </div>
              <p
                className={cn(
                  'mt-2 text-2xl font-bold tabular-nums text-white',
                  kpis && !projecao.isProjetada && 'text-white/50 line-through decoration-white/60',
                )}
              >
                {showSkeleton || !kpis ? '—' : formatCurrency(projecao.faturamento)}
              </p>
              {kpis && isFinite(projecao.variacao) && projecao.variacao !== 0 && (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold tabular-nums">
                  {projecao.variacao >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-300" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-300" />
                  )}
                  <span className={projecao.variacao >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    {projecao.variacao >= 0 ? '+' : ''}
                    {projecao.variacao.toFixed(1).replace('.', ',')}%
                  </span>
                  <span className="text-white/70">vs anterior</span>
                </div>
              )}
              {kpis && !projecao.isProjetada && (
                <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-white/70">
                  <Info className="mt-px h-3 w-3 shrink-0" />
                  Sem dias futuros — projeção = realizado.
                </p>
              )}
            </div>
          </div>

          <Suspense fallback={<RouteFallback />}>
            <AbastecimentosTab />
          </Suspense>
        </>
      )}
    </div>
  )
}

export default Abastecimentos
