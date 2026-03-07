import { useState } from 'react'
import { Fuel, Package, Store, Globe, TrendingUp, ChevronDown } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { SectorKpi, ProjectionRow } from '@/pages/Dashboard/hooks/useDashboardData'

interface SectorKpiCardsProps {
  sectorKpis: SectorKpi[]
  globalKpi: SectorKpi
  projectionData: ProjectionRow[]
}

const sectorIcons = [Fuel, Package, Store, Globe]
const sectorColors = [
  'border-red-500 bg-red-50/30 dark:bg-red-950/30',
  'border-blue-500 bg-blue-50/30 dark:bg-blue-950/30',
  'border-amber-500 bg-amber-50/30 dark:bg-amber-950/30',
  'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30',
]

const SectorKpiCards = ({ sectorKpis, globalKpi, projectionData }: SectorKpiCardsProps) => {
  const [showProjection, setShowProjection] = useState(true)
  const allKpis = [...sectorKpis, globalKpi]

  return (
    <div className="space-y-4">
      {/* KPI cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {allKpis.map((kpi, index) => {
          const Icon = sectorIcons[index] ?? Globe
          const colorClass = sectorColors[index] ?? sectorColors[3]

          return (
            <div
              key={kpi.label}
              className={`rounded-xl border-l-4 bg-white p-5 shadow-sm dark:bg-gray-900 ${colorClass}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{kpi.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lucro bruto</p>
                </div>
                <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>

              <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(kpi.lucroBruto)}
              </p>

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
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
