import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters'

interface CompanyRow {
  empresaCodigo: number
  empresa: string
  faturamento: number
  volume: number
  margem: number
  variacao: number
  [key: string]: unknown
}

interface SectorDetailTableProps {
  data: CompanyRow[]
}

const columns: Column<CompanyRow>[] = [
  {
    key: 'empresa',
    label: 'Empresa',
    sortable: true,
  },
  {
    key: 'faturamento',
    label: 'Faturamento',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.faturamento),
  },
  {
    key: 'volume',
    label: 'Volume',
    align: 'right',
    sortable: true,
    render: (row) => formatNumber(row.volume),
  },
  {
    key: 'margem',
    label: 'Margem',
    align: 'right',
    sortable: true,
    render: (row) => formatPercent(row.margem),
  },
  {
    key: 'variacao',
    label: 'Variação',
    align: 'right',
    sortable: true,
    render: (row) => (
      <HeatmapCell
        value={row.variacao}
        min={-50}
        max={50}
        formatted={`${row.variacao >= 0 ? '+' : ''}${row.variacao.toFixed(1)}%`}
      />
    ),
  },
]

const SectorDetailTable = ({ data }: SectorDetailTableProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Detalhamento por Empresa</h2>
      </div>
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.empresaCodigo}
      />
    </div>
  )
}

export default SectorDetailTable
