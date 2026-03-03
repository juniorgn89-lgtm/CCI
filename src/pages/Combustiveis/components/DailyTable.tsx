import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatDate, formatLiters } from '@/lib/formatters'

interface DailyRow {
  data: string
  litros: number
  faturamento: number
  custo: number
  margemRs: number
  margemPct: number
  [key: string]: unknown
}

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
    key: 'litros',
    label: 'Litros',
    align: 'right',
    sortable: true,
    render: (row) => formatLiters(row.litros),
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
        max={30}
        formatted={`${row.margemPct.toFixed(1)}%`}
      />
    ),
  },
]

const DailyTable = ({ data }: DailyTableProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <DataTable columns={columns} data={data} keyExtractor={(row) => row.data} />
    </div>
  )
}

export default DailyTable
