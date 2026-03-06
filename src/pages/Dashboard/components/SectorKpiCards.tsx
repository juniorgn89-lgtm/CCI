import { Fuel, Package, Store, Globe, TrendingUp } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import type { SectorKpi, ProjectionRow } from '@/pages/Dashboard/hooks/useDashboardData'

interface SectorKpiCardsProps {
  sectorKpis: SectorKpi[]
  globalKpi: SectorKpi
  projectionData: ProjectionRow[]
}

const sectorIcons = [Fuel, Package, Store, Globe]
const sectorColors = [
  'border-red-500 bg-red-50/30',
  'border-blue-500 bg-blue-50/30',
  'border-amber-500 bg-amber-50/30',
  'border-emerald-500 bg-emerald-50/30',
]

const SectorKpiCards = ({ sectorKpis, globalKpi, projectionData }: SectorKpiCardsProps) => {
  const allKpis = [...sectorKpis, globalKpi]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {allKpis.map((kpi, index) => {
        const Icon = sectorIcons[index] ?? Globe
        const colorClass = sectorColors[index] ?? sectorColors[3]

        return (
          <div
            key={kpi.label}
            className={`rounded-xl border-l-4 bg-white p-5 shadow-sm ${colorClass}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{kpi.label}</p>
                <p className="text-xs text-gray-500">Lucro bruto</p>
              </div>
              <Icon className="h-5 w-5 text-gray-400" />
            </div>

            <p className="mt-3 text-2xl font-bold text-gray-900">
              {formatCurrency(kpi.lucroBruto)}
            </p>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
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

      {/* Projection mini-table */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Projeção</p>
          <TrendingUp className="h-5 w-5 text-gray-400" />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="pb-1 text-left font-medium">Setor</th>
              <th className="pb-1 text-right font-medium">Faturamento</th>
              <th className="pb-1 text-right font-medium">Lucro bruto</th>
              <th className="pb-1 text-right font-medium">Margem</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {projectionData.map((row) => (
              <tr key={row.setor} className={row.setor === 'Total' ? 'font-semibold border-t border-gray-200' : ''}>
                <td className="py-0.5">{row.setor}</td>
                <td className="py-0.5 text-right">{formatCurrency(row.faturamento)}</td>
                <td className="py-0.5 text-right">{formatCurrency(row.lucroBruto)}</td>
                <td className="py-0.5 text-right">{formatPercent(row.margem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SectorKpiCards
