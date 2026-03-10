import { useCallback } from 'react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type { DailyRow } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface DailyTableProps {
  data: DailyRow[]
}

const columns: Column<DailyRow>[] = [
  {
    key: 'data',
    label: 'Data',
    sortable: true,
    render: (row) => formatDate(row.data),
  },
  {
    key: 'qtdItens',
    label: 'Qtd Itens',
    align: 'right',
    sortable: true,
    render: (row) => formatNumber(row.qtdItens),
  },
  {
    key: 'faturamento',
    label: 'Faturamento',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.faturamento),
  },
  {
    key: 'custo',
    label: 'Custo',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.custo),
  },
  {
    key: 'margemRs',
    label: 'Margem R$',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.margemRs),
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

const csvColumns: ExportColumn<DailyRow>[] = [
  { header: 'Data', accessor: (r) => r.data },
  { header: 'Qtd Itens', accessor: (r) => r.qtdItens },
  { header: 'Faturamento', accessor: (r) => r.faturamento },
  { header: 'Custo', accessor: (r) => r.custo },
  { header: 'Margem R$', accessor: (r) => r.margemRs },
  { header: 'Margem %', accessor: (r) => r.margemPct },
]

const DailyTable = ({ data }: DailyTableProps) => {
  const handleExport = useCallback(() => {
    exportToCsv('conveniencias-diario', data, csvColumns)
  }, [data])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Resumo diario</span>
        <ExportButton onExport={handleExport} />
      </div>
      <DataTable columns={columns} data={data} keyExtractor={(row) => row.data} />
    </div>
  )
}

export default DailyTable
