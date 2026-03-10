import { useCallback } from 'react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import { cn } from '@/lib/utils'
import type { FuelTypeRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface FuelTypeTableProps {
  data: FuelTypeRow[]
}

const ParticipationBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="h-2 w-20 rounded-full bg-gray-100 dark:bg-gray-700">
      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
    <span className="text-xs tabular-nums">{value.toFixed(1)}%</span>
  </div>
)

const columns: Column<FuelTypeRow>[] = [
  { key: 'nome', label: 'Combustível', sortable: true },
  { key: 'litros', label: 'Litros', align: 'right', sortable: true, render: (row) => formatLiters(row.litros) },
  { key: 'participacao', label: 'Participação', align: 'right', sortable: true, render: (row) => <ParticipationBar value={row.participacao} /> },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (row) => formatCurrency(row.faturamento) },
  { key: 'lucroBruto', label: 'Lucro bruto', align: 'right', sortable: true, render: (row) => (
    <span className={cn('font-medium', row.lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
      {formatCurrency(row.lucroBruto)}
    </span>
  )},
  { key: 'precoMedioVenda', label: 'Preço venda', align: 'right', sortable: true, render: (row) => formatCurrency(row.precoMedioVenda) },
  { key: 'precoCustoMedio', label: 'Preço custo', align: 'right', sortable: true, render: (row) => formatCurrency(row.precoCustoMedio) },
  { key: 'lbPorLitro', label: 'L.B./Litro', align: 'right', sortable: true, render: (row) => formatCurrency(row.lbPorLitro) },
  {
    key: 'margem', label: 'Margem', align: 'right', sortable: true,
    render: (row) => <HeatmapCell value={row.margem} min={-10} max={30} formatted={`${row.margem.toFixed(1)}%`} />,
  },
]

const csvColumns: ExportColumn<FuelTypeRow>[] = [
  { header: 'Combustível', accessor: (r) => r.nome },
  { header: 'Litros', accessor: (r) => r.litros },
  { header: 'Participação %', accessor: (r) => r.participacao },
  { header: 'Faturamento', accessor: (r) => r.faturamento },
  { header: 'Custo', accessor: (r) => r.custo },
  { header: 'Lucro Bruto', accessor: (r) => r.lucroBruto },
  { header: 'Preço Venda', accessor: (r) => r.precoMedioVenda },
  { header: 'Preço Custo', accessor: (r) => r.precoCustoMedio },
  { header: 'L.B./Litro', accessor: (r) => r.lbPorLitro },
  { header: 'Margem %', accessor: (r) => r.margem },
]

const FuelTypeTable = ({ data }: FuelTypeTableProps) => {
  const handleExport = useCallback(() => {
    exportToCsv('combustiveis-tipo', data, csvColumns)
  }, [data])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Por tipo de combustível</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detalhamento por produto com participação e margens</p>
        </div>
        <ExportButton onExport={handleExport} />
      </div>
      <DataTable columns={columns} data={data} keyExtractor={(row) => row.produtoCodigo} />
    </div>
  )
}

export default FuelTypeTable
