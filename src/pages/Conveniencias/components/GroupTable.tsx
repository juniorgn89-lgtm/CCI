import { useCallback } from 'react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type { GroupRow } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface GroupTableProps {
  data: GroupRow[]
}

const columns: Column<GroupRow>[] = [
  {
    key: 'nome',
    label: 'Grupo',
    sortable: true,
  },
  {
    key: 'quantidade',
    label: 'Qtd Vendida',
    align: 'right',
    sortable: true,
    render: (row) => formatNumber(row.quantidade),
  },
  {
    key: 'faturamento',
    label: 'Faturamento',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.faturamento),
  },
  {
    key: 'margemTotal',
    label: 'Margem R$',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.margemTotal),
  },
  {
    key: 'margemPct',
    label: 'Margem %',
    align: 'right',
    sortable: true,
    render: (row) => (
      <HeatmapCell
        value={row.margemPct}
        min={-10}
        max={40}
        formatted={`${row.margemPct.toFixed(1)}%`}
      />
    ),
  },
]

const csvColumns: ExportColumn<GroupRow>[] = [
  { header: 'Grupo', accessor: (r) => r.nome },
  { header: 'Qtd Vendida', accessor: (r) => r.quantidade },
  { header: 'Faturamento', accessor: (r) => r.faturamento },
  { header: 'Margem R$', accessor: (r) => r.margemTotal },
  { header: 'Margem %', accessor: (r) => r.margemPct },
]

const GroupTable = ({ data }: GroupTableProps) => {
  const handleExport = useCallback(() => {
    exportToCsv('conveniencias-grupo', data, csvColumns)
  }, [data])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Por grupo</span>
        <ExportButton onExport={handleExport} />
      </div>
      <DataTable columns={columns} data={data} keyExtractor={(row) => row.grupoCodigo} />
    </div>
  )
}

export default GroupTable
