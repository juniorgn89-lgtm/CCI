import { useMemo, useState } from 'react'
import { LayoutDashboard, TrendingUp, Target } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import VisaoGeral from '@/pages/Operacao/components/produtividade/VisaoGeral'
import Projecoes from '@/pages/Operacao/components/produtividade/Projecoes'
import Metas from '@/pages/Operacao/components/produtividade/Metas'
import type { FrentistaRow, AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'

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

type SubTab = 'visao' | 'projecoes' | 'metas'

const subTabs: { key: SubTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'projecoes', label: 'Projeções', icon: TrendingUp },
  { key: 'metas', label: 'Metas', icon: Target },
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
  isLoading: boolean
}

/* ── Component ──────────────────────────────────────────── */

const ProdutividadeTab = ({
  frentistaRows,
  frentistaRowsPrev,
  abastecimentoRows,
  isLoading,
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

      {active === 'visao' && <VisaoGeral frentistas={frentistas} periodInfo={periodInfo} />}
      {active === 'projecoes' && <Projecoes frentistas={frentistas} periodInfo={periodInfo} />}
      {active === 'metas' && <Metas frentistas={frentistas} />}
    </div>
  )
}

export default ProdutividadeTab
