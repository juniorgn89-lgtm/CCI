import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatLiters } from '@/lib/formatters'

interface FuelTypeRow {
  produtoCodigo: number
  tipo: string
  litros: number
  faturamento: number
  precoMedio: number
  margem: number
  [key: string]: unknown
}

interface FuelTypeTableProps {
  data: FuelTypeRow[]
}

const columns: Column<FuelTypeRow>[] = [
  {
    key: 'tipo',
    label: 'Tipo',
    sortable: true,
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
    key: 'precoMedio',
    label: 'Preço Médio',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.precoMedio),
  },
  {
    key: 'margem',
    label: 'Margem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <HeatmapCell
        value={row.margem}
        min={-10}
        max={30}
        formatted={`${row.margem.toFixed(1)}%`}
      />
    ),
  },
]

const FuelTypeTable = ({ data }: FuelTypeTableProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <DataTable columns={columns} data={data} keyExtractor={(row) => row.produtoCodigo} />
    </div>
  )
}

export default FuelTypeTable
