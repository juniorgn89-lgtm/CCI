import { useState } from 'react'
import { Fuel, Package, Store, Globe, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { SectorKpi, ProjectionRow } from '@/pages/Dashboard/hooks/useDashboardData'

interface SectorKpiCardsProps {
  sectorKpis: SectorKpi[]
  globalKpi: SectorKpi
  projectionData: ProjectionRow[]
}

const sectorIcons = [Fuel, Package, Store, Globe]
const sectorBgs = [
  'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900',
  'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
  'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
  'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
]
const sectorIconBgs = [
  'bg-red-100 dark:bg-red-900/30',
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-amber-100 dark:bg-amber-900/30',
  'bg-emerald-100 dark:bg-emerald-900/30',
]
const sectorIconColors = [
  'text-red-600 dark:text-red-400',
  'text-blue-600 dark:text-blue-400',
  'text-amber-600 dark:text-amber-400',
  'text-emerald-600 dark:text-emerald-400',
]

const SectorKpiCards = ({ sectorKpis, globalKpi, projectionData }: SectorKpiCardsProps) => {
  const [showProjection, setShowProjection] = useState(true)
  const allKpis = [...sectorKpis, globalKpi]

  return (
    <div className="space-y-4">
      {/* KPI cards row */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {allKpis.map((kpi, index) => {
          const Icon = sectorIcons[index] ?? Globe
          const bgClass = sectorBgs[index] ?? sectorBgs[3]
          const iconBgClass = sectorIconBgs[index] ?? sectorIconBgs[3]
          const iconColorClass = sectorIconColors[index] ?? sectorIconColors[3]

          return (
            <div
              key={kpi.label}
              className={cn('rounded-lg border border-gray-200/60 px-3 py-2.5 shadow-sm dark:border-gray-700/60', bgClass)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{kpi.label}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Lucro bruto</p>
                </div>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', iconBgClass)}>
                  <Icon className={cn('h-3.5 w-3.5', iconColorClass)} />
                </div>
              </div>

              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(kpi.lucroBruto)}
              </p>

              {kpi.prevYearLucroBruto != null && kpi.prevYearLucroBruto > 0 && (() => {
                const diff = kpi.lucroBruto - kpi.prevYearLucroBruto
                const pct = (diff / kpi.prevYearLucroBruto) * 100
                const positive = diff >= 0
                const isNeutral = Math.abs(pct) < 0.5
                const badgeColor = isNeutral
                  ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  : positive
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                const Icon = isNeutral ? TrendingUp : positive ? TrendingUp : TrendingDown
                const text = isNeutral ? 'estável' : `${positive ? '+' : ''}${pct.toFixed(1)}%`
                return (
                  <div className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', badgeColor)}>
                    <Icon className="h-3 w-3" />
                    <span>{text}</span>
                    <span className="text-[10px] opacity-70">vs ano anterior</span>
                  </div>
                )
              })()}

              <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <div>
                  <span className="font-medium">{formatPercent(kpi.margem)}</span>
                  <span className="ml-1">Margem</span>
                </div>
                {kpi.lbPorLitro !== undefined ? (
                  <div>
                    <span className="font-medium">{formatCurrency(kpi.lbPorLitro)}</span>
                    <span className="ml-1">L. bruto litro</span>
                  </div>
                ) : (
                  <div>
                    <span className="font-medium">{formatCurrency(kpi.faturamento)}</span>
                    <span className="ml-1">Faturamento</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Projection toggle */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={() => setShowProjection(!showProjection)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projeção</p>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform duration-200',
              showProjection && 'rotate-180'
            )}
          />
        </button>
        {showProjection && (
          <div className="overflow-x-auto border-t border-gray-200 px-5 pb-5 pt-3 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="pb-2 text-left font-medium">Setor</th>
                  <th className="pb-2 text-right font-medium">Faturamento</th>
                  <th className="pb-2 text-right font-medium">Lucro bruto</th>
                  <th className="pb-2 text-right font-medium">Margem</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {projectionData.map((row) => (
                  <tr
                    key={row.setor}
                    className={row.setor === 'Total' ? 'font-semibold border-t border-gray-300 dark:border-gray-600' : ''}
                  >
                    <td className="py-1.5">{row.setor}</td>
                    <td className="py-1.5 text-right">{formatCurrency(row.faturamento)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(row.lucroBruto)}</td>
                    <td className="py-1.5 text-right">{formatPercent(row.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SectorKpiCards
