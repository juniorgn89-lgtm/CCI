import { useCallback } from 'react'
import { Fuel, Droplets, DollarSign, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import type { BombaRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface BombaViewProps {
  data: BombaRow[]
}

const csvColumns: ExportColumn<BombaRow>[] = [
  { header: 'Bico', accessor: (r) => r.bicoDescricao },
  { header: 'Combustivel', accessor: (r) => r.combustivelNome },
  { header: 'Litros', accessor: (r) => r.litros },
  { header: 'Receita', accessor: (r) => r.receita },
  { header: 'Lucro Bruto', accessor: (r) => r.lucroBruto },
  { header: 'Margem %', accessor: (r) => r.margem },
  { header: 'Abastecimentos', accessor: (r) => r.totalAbastecimentos },
  { header: 'Ticket Medio', accessor: (r) => r.ticketMedio },
]

const RANK_COLORS = [
  'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
  'border-gray-400 bg-gray-50 dark:bg-gray-800/50',
  'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
]

const BombaView = ({ data }: BombaViewProps) => {
  const maxLitros = data.length > 0 ? Math.max(...data.map((d) => d.litros)) : 1

  const handleExport = useCallback(() => {
    exportToCsv('combustiveis-bombas', data, csvColumns)
  }, [data])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Visao por Bico/Bomba</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.length} bicos ativos no periodo selecionado
          </p>
        </div>
        <ExportButton onExport={handleExport} />
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-400">Nenhum dado de bico/bomba encontrado no periodo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((bico, index) => {
            const fillPercent = maxLitros > 0 ? (bico.litros / maxLitros) * 100 : 0
            const rankClass = index < 3 ? RANK_COLORS[index] : 'border-gray-200 dark:border-gray-700'

            return (
              <div
                key={bico.bicoCodigo}
                className={cn(
                  'relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900',
                  rankClass
                )}
              >
                {/* Rank badge for top 3 */}
                {index < 3 && (
                  <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">
                    {index + 1}
                  </div>
                )}

                {/* Header */}
                <div className="mb-4 flex items-center gap-3">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    bico.margem >= 10
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : bico.margem >= 0
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                  )}>
                    <Fuel className={cn(
                      'h-5 w-5',
                      bico.margem >= 10
                        ? 'text-green-600 dark:text-green-400'
                        : bico.margem >= 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-red-600 dark:text-red-400'
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {bico.bicoDescricao}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {bico.combustivelNome}
                    </p>
                  </div>
                </div>

                {/* Volume bar */}
                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Volume relativo</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {fillPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">Litros</p>
                      <p className="truncate text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatLiters(bico.litros)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">Receita</p>
                      <p className="truncate text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(bico.receita)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">Abastecimentos</p>
                      <p className="truncate text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatNumber(bico.totalAbastecimentos)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold',
                      bico.margem >= 10 ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                        : bico.margem >= 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                    )}>
                      %
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">Margem</p>
                      <p className={cn(
                        'truncate text-sm font-semibold tabular-nums',
                        bico.margem >= 10 ? 'text-green-600 dark:text-green-400'
                          : bico.margem >= 0 ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {bico.margem.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BombaView
