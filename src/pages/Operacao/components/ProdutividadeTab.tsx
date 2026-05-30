import { useMemo, useState } from 'react'
import { LayoutDashboard, TrendingUp, Target, Award, Users, Zap, Fuel, Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatLiters, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import VisaoGeral from '@/pages/Operacao/components/produtividade/VisaoGeral'
import Projecoes from '@/pages/Operacao/components/produtividade/Projecoes'
import Metas from '@/pages/Operacao/components/produtividade/Metas'
import Destaques from '@/pages/Operacao/components/produtividade/Destaques'
import type { FrentistaRow, AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import type { FrentistaScore } from '@/lib/frentistaScore'

/* ── Types compartilhados ───────────────────────────────── */

export interface FrentistaProdRow {
  funcionarioCodigo: number
  nome: string
  // Current period
  litros: number
  atendimentos: number
  faturamento: number
  ticketMedio: number
  // Fuel breakdown current period
  litrosGasolina: number
  litrosEtanol: number
  litrosDiesel: number
  // Previous period
  prevLitros: number
  prevFaturamento: number
  // Variation % (positive/negative)
  varLitrosPct: number
  hasPrev: boolean
  // Daily series for projections chart
  dailyLitros: { data: string; litros: number }[]
}

export interface PeriodInfo {
  dataInicial: string
  dataFinal: string
  todayStr: string
  daysRemaining: number
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parseLocal = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const categorizeFuel = (nome: string): 'gasolina' | 'etanol' | 'diesel' | 'outros' => {
  const u = nome.toUpperCase()
  if (u.includes('GASOLINA')) return 'gasolina'
  if (u.includes('ETANOL') || u.includes('ALCOOL') || u.includes('ÁLCOOL')) return 'etanol'
  if (u.includes('DIESEL') || u.includes('S-10') || u.includes('S10') || u.includes('S500')) return 'diesel'
  return 'outros'
}

/* ── Sub-tabs ───────────────────────────────────────────── */

type SubTab = 'visao' | 'projecoes' | 'metas' | 'destaques'

const subTabs: { key: SubTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'projecoes', label: 'Projeções', icon: TrendingUp },
  { key: 'metas', label: 'Metas', icon: Target },
  { key: 'destaques', label: 'Destaques', icon: Award },
]

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
  frentistaRows: FrentistaRow[]
  frentistaRowsPrev: FrentistaRow[]
  abastecimentoRows: AbastecimentoRow[]
  abastecimentoRowsPrev: AbastecimentoRow[]
  isLoading: boolean
  /** KPIs principais do módulo, renderizados como primeira seção da aba Visão Geral. */
  topKpis?: {
    frentistasAtivos: number
    totalAbastecimentos: number
    prevTotalAbastecimentos: number
    ritmo: number
    ritmoPrev: number
    topFrentistaNome: string | null
    topFrentistaLitros: number
  }
  /** Score 0–100 por frentista (funcionarioCodigo → score). Vazio enquanto o
   * custo (lucro bruto) ainda carrega. */
  frentistaScores?: Map<number, FrentistaScore>
}

/* ── Component ──────────────────────────────────────────── */

const ProdutividadeTab = ({
  frentistaRows,
  frentistaRowsPrev,
  abastecimentoRows,
  abastecimentoRowsPrev,
  isLoading,
  topKpis,
  frentistaScores,
}: ProdutividadeTabProps) => {
  const [active, setActive] = useState<SubTab>('visao')
  const { dataInicial, dataFinal } = useFilterStore()

  const periodInfo: PeriodInfo = useMemo(() => {
    const todayStr = ymd(new Date())
    let daysRemaining = 0
    if (dataInicial && dataFinal && todayStr < dataFinal) {
      const cursorStart = todayStr < dataInicial ? dataInicial : todayStr
      const start = parseLocal(cursorStart)
      const end = parseLocal(dataFinal)
      daysRemaining = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000))
      )
    }
    return { dataInicial, dataFinal, todayStr, daysRemaining }
  }, [dataInicial, dataFinal])

  const frentistas: FrentistaProdRow[] = useMemo(() => {
    const prevMap = new Map<number, FrentistaRow>()
    for (const f of frentistaRowsPrev) prevMap.set(f.funcionarioCodigo, f)

    const fuelMap = new Map<number, { gasolina: number; etanol: number; diesel: number }>()
    const dailyMap = new Map<number, Map<string, number>>()

    for (const a of abastecimentoRows) {
      const fuel = categorizeFuel(a.produtoNome)
      const fb = fuelMap.get(a.frentistaCodigo) ?? { gasolina: 0, etanol: 0, diesel: 0 }
      if (fuel === 'gasolina') fb.gasolina += a.litros
      else if (fuel === 'etanol') fb.etanol += a.litros
      else if (fuel === 'diesel') fb.diesel += a.litros
      fuelMap.set(a.frentistaCodigo, fb)

      const dayStr = a.dataHora.substring(0, 10)
      if (dayStr.length === 10) {
        const dm = dailyMap.get(a.frentistaCodigo) ?? new Map<string, number>()
        dm.set(dayStr, (dm.get(dayStr) ?? 0) + a.litros)
        dailyMap.set(a.frentistaCodigo, dm)
      }
    }

    return frentistaRows
      .map((f) => {
        const prev = prevMap.get(f.funcionarioCodigo)
        const fb = fuelMap.get(f.funcionarioCodigo) ?? { gasolina: 0, etanol: 0, diesel: 0 }
        const dm = dailyMap.get(f.funcionarioCodigo) ?? new Map<string, number>()
        const dailyLitros = Array.from(dm.entries())
          .map(([data, litros]) => ({ data, litros }))
          .sort((a, b) => a.data.localeCompare(b.data))

        const prevLitros = prev?.litrosVendidos ?? 0
        const hasPrev = prevLitros > 0
        const varLitrosPct = hasPrev ? ((f.litrosVendidos - prevLitros) / prevLitros) * 100 : 0

        return {
          funcionarioCodigo: f.funcionarioCodigo,
          nome: f.nome,
          litros: f.litrosVendidos,
          atendimentos: f.atendimentos,
          faturamento: f.faturamento,
          ticketMedio: f.ticketMedio,
          litrosGasolina: fb.gasolina,
          litrosEtanol: fb.etanol,
          litrosDiesel: fb.diesel,
          prevLitros,
          prevFaturamento: prev?.faturamento ?? 0,
          varLitrosPct,
          hasPrev,
          dailyLitros,
        }
      })
      .sort((a, b) => b.litros - a.litros)
  }, [frentistaRows, frentistaRowsPrev, abastecimentoRows])

  if (isLoading) return <ProdSkeleton />

  return (
    <div className="space-y-5">
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {subTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-all',
                isActive
                  ? 'border border-gray-200 bg-white font-medium text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
                  : 'border border-transparent bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {active === 'visao' && (
        <div className="space-y-4">
          {topKpis && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-amber-950/20 dark:to-gray-900">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Frentistas Ativos</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatNumber(topKpis.frentistasAtivos)}
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
                  {`${topKpis.ritmo.toFixed(1).replace('.', ',')}/h`}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <DeltaBadge current={topKpis.ritmo} previous={topKpis.ritmoPrev} />
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
                  {formatNumber(topKpis.totalAbastecimentos)}
                </p>
                <DeltaBadge current={topKpis.totalAbastecimentos} previous={topKpis.prevTotalAbastecimentos} />
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
          <VisaoGeral frentistas={frentistas} periodInfo={periodInfo} scores={frentistaScores} />
        </div>
      )}
      {active === 'projecoes' && <Projecoes frentistas={frentistas} periodInfo={periodInfo} />}
      {active === 'metas' && <Metas frentistas={frentistas} />}
      {active === 'destaques' && (
        <Destaques
          frentistas={frentistas}
          periodInfo={periodInfo}
          abastecimentoRowsPrev={abastecimentoRowsPrev}
        />
      )}
    </div>
  )
}

export default ProdutividadeTab
