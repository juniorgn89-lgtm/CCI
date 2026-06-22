import { Users, Fuel, Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { formatLiters, formatNumber } from '@/lib/formatters'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import VisaoGeral from '@/pages/Operacao/components/produtividade/VisaoGeral'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import type { AbastecimentoRow as AbastecimentoComCusto } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import type { FrentistaDescAcr } from '@/pages/Operacao/hooks/useFuelVendaCost'

/* ── Skeleton ───────────────────────────────────────────── */

const ProdSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-72 rounded-xl" />
  </div>
)

/* ── Props ──────────────────────────────────────────────── */

interface ProdutividadeTabProps {
  abastecimentoRows: AbastecimentoRow[]
  /** Linhas com custo/lucro (do analytics) — alimentam o Lucro bruto por dia. */
  abastComCusto?: AbastecimentoComCusto[]
  /** Acréscimo/desconto reais por frentista+produto (`func|prod`), combustível. */
  descAcrByFrentista?: Map<string, FrentistaDescAcr>
  isLoading: boolean
  /** KPIs principais do módulo, renderizados como primeira seção da aba. */
  topKpis?: {
    frentistasAtivos: number
    totalAbastecimentos: number
    prevTotalAbastecimentos: number
    ritmo: number
    ritmoPrev: number
    topFrentistaNome: string | null
    topFrentistaLitros: number
  }
}

/* ── Component ──────────────────────────────────────────── */

const ProdutividadeTab = ({
  abastecimentoRows,
  abastComCusto,
  descAcrByFrentista,
  isLoading,
  topKpis,
}: ProdutividadeTabProps) => {
  if (isLoading) return <ProdSkeleton />

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {topKpis && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-amber-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Frentistas Ativos</p>
                  <InfoHint text="Frentistas com pelo menos um atendimento no período." />
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatNumber(topKpis.frentistasAtivos)}
              </p>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">com atendimento no período</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-cyan-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-cyan-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Abastecimentos</p>
                  <InfoHint text="Total de abastecimentos no período · variação vs período comparativo." />
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <Fuel className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatNumber(topKpis.totalAbastecimentos)}
              </p>
              <DeltaBadge current={topKpis.totalAbastecimentos} previous={topKpis.prevTotalAbastecimentos} />
            </div>

            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Frentista Destaque</p>
                  <InfoHint text="Frentista com mais litros vendidos no período." />
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className={cn(
                'mt-2 truncate text-2xl font-bold tabular-nums',
                topKpis.topFrentistaNome ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
              )}>
                {topKpis.topFrentistaNome ?? '—'}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                {topKpis.topFrentistaNome ? formatLiters(topKpis.topFrentistaLitros) : ''}
              </p>
            </div>
          </div>
        )}
        <VisaoGeral abastecimentos={abastecimentoRows} abastComCusto={abastComCusto} descAcrByFrentista={descAcrByFrentista} />
      </div>
    </div>
  )
}

export default ProdutividadeTab
