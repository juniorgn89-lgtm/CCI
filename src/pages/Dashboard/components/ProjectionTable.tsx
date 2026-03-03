import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatPercent } from '@/lib/formatters'

interface ProjectionRow {
  periodo: string
  realizado: number
  projecao: number
  meta: number
  percentAtingido: number
  [key: string]: unknown
}

interface ProjectionTableProps {
  data: ProjectionRow[]
}

const columns: Column<ProjectionRow>[] = [
  {
    key: 'periodo',
    label: 'Período',
  },
  {
    key: 'realizado',
    label: 'Realizado',
    align: 'right',
    render: (row) => formatCurrency(row.realizado),
  },
  {
    key: 'projecao',
    label: 'Projeção',
    align: 'right',
    render: (row) => formatCurrency(row.projecao),
  },
  {
    key: 'meta',
    label: 'Meta',
    align: 'right',
    render: (row) => formatCurrency(row.meta),
  },
  {
    key: 'percentAtingido',
    label: '% Atingido',
    align: 'right',
    render: (row) => (
      <HeatmapCell
        value={row.percentAtingido}
        min={0}
        max={120}
        formatted={formatPercent(row.percentAtingido)}
      />
    ),
  },
]

const ProjectionTable = ({ data }: ProjectionTableProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Projeção Mensal</h2>
      </div>
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.periodo}
      />
    </div>
  )
}

export default ProjectionTable
