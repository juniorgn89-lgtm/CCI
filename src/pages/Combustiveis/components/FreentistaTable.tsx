import { useCallback } from 'react'
import { Trophy } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type { FreentistaRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface FreentistaTableProps {
  data: FreentistaRow[]
}

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank > 3) return <span className="text-sm tabular-nums text-gray-400">{rank}</span>
  const colors = [
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  ]
  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', colors[rank - 1])}>
      {rank}
    </span>
  )
}

const columns: Column<FreentistaRow & { rank: number }>[] = [
  {
    key: 'rank',
    label: '#',
    sortable: false,
    align: 'center',
    render: (row) => <RankBadge rank={row.rank} />,
  },
  {
    key: 'frentistaNome',
    label: 'Frentista',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        {row.rank === 1 && <Trophy className="h-4 w-4 text-amber-500" />}
        <span className="font-medium text-gray-900 dark:text-gray-100">{row.frentistaNome}</span>
      </div>
    ),
  },
  {
    key: 'litros',
    label: 'Litros',
    align: 'right',
    sortable: true,
    render: (row) => formatLiters(row.litros),
  },
  {
    key: 'receita',
    label: 'Receita',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.receita),
  },
  {
    key: 'lucroBruto',
    label: 'Lucro bruto',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={cn('font-medium', row.lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {formatCurrency(row.lucroBruto)}
      </span>
    ),
  },
  {
    key: 'totalAbastecimentos',
    label: 'Abast.',
    align: 'right',
    sortable: true,
    render: (row) => formatNumber(row.totalAbastecimentos),
  },
  {
    key: 'ticketMedio',
    label: 'Ticket medio',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.ticketMedio),
  },
  {
    key: 'litrosPorAbastecimento',
    label: 'L/Abast.',
    align: 'right',
    sortable: true,
    render: (row) => `${row.litrosPorAbastecimento.toFixed(1)} L`,
  },
  {
    key: 'margem',
    label: 'Margem',
    align: 'right',
    sortable: true,
    render: (row) => <HeatmapCell value={row.margem} min={-10} max={30} formatted={`${row.margem.toFixed(1)}%`} />,
  },
]

const csvColumns: ExportColumn<FreentistaRow>[] = [
  { header: 'Frentista', accessor: (r) => r.frentistaNome },
  { header: 'Litros', accessor: (r) => r.litros },
  { header: 'Receita', accessor: (r) => r.receita },
  { header: 'Lucro Bruto', accessor: (r) => r.lucroBruto },
  { header: 'Abastecimentos', accessor: (r) => r.totalAbastecimentos },
  { header: 'Ticket Medio', accessor: (r) => r.ticketMedio },
  { header: 'L/Abast.', accessor: (r) => r.litrosPorAbastecimento },
  { header: 'Margem %', accessor: (r) => r.margem },
]

const FreentistaTable = ({ data }: FreentistaTableProps) => {
  const rankedData = data.map((row, index) => ({ ...row, rank: index + 1 }))

  const handleExport = useCallback(() => {
    exportToCsv('combustiveis-frentistas', data, csvColumns)
  }, [data])

  return (
    <div className="space-y-4">
      {/* Top 3 highlight cards */}
      {data.length >= 3 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {data.slice(0, 3).map((f, i) => {
            const medals = ['border-amber-400 bg-white dark:bg-gray-900', 'border-gray-400 bg-white dark:bg-gray-900', 'border-orange-400 bg-white dark:bg-gray-900']
            const positions = ['1o Lugar', '2o Lugar', '3o Lugar']
            return (
              <div key={f.frentistaCodigo} className={cn('rounded-xl border-2 p-5 shadow-sm', medals[i])}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {positions[i]}
                  </span>
                  {i === 0 && <Trophy className="h-5 w-5 text-amber-500" />}
                </div>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{f.frentistaNome}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Litros</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(f.litros)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Receita</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(f.receita)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Abastecimentos</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(f.totalAbastecimentos)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Margem</p>
                    <p className={cn(
                      'text-sm font-semibold tabular-nums',
                      f.margem >= 10 ? 'text-green-600 dark:text-green-400' : f.margem >= 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {f.margem.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Ranking de frentistas</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data.length} frentistas ativos no periodo, ordenados por litros vendidos
            </p>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-400">Nenhum dado de frentista encontrado no periodo.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rankedData}
            keyExtractor={(row) => row.frentistaCodigo}
          />
        )}
      </div>
    </div>
  )
}

export default FreentistaTable
