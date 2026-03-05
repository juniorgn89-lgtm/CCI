import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatNumber } from '@/lib/formatters'
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

const GroupTable = ({ data }: GroupTableProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <DataTable columns={columns} data={data} keyExtractor={(row) => row.grupoCodigo} />
    </div>
  )
}

export default GroupTable
