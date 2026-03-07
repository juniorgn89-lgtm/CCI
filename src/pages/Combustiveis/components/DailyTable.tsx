import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatDate, formatLiters } from '@/lib/formatters'
import type { DailyRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface DailyTableProps {
  data: DailyRow[]
}

const columns: Column<DailyRow>[] = [
  { key: 'data', label: 'Data', sortable: true, render: (row) => formatDate(row.data) },
  { key: 'abastecimentos', label: 'Abast.', align: 'right', sortable: true, render: (row) => new Intl.NumberFormat('pt-BR').format(row.abastecimentos) },
  { key: 'litros', label: 'Litros', align: 'right', sortable: true, render: (row) => formatLiters(row.litros) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (row) => formatCurrency(row.faturamento) },
  { key: 'custo', label: 'Custo', align: 'right', sortable: true, render: (row) => formatCurrency(row.custo) },
  { key: 'lucroBruto', label: 'Lucro bruto', align: 'right', sortable: true, render: (row) => formatCurrency(row.lucroBruto) },
  {
    key: 'margemPct', label: 'Margem', align: 'right', sortable: true,
    render: (row) => <HeatmapCell value={row.margemPct} min={-10} max={30} formatted={`${row.margemPct.toFixed(1)}%`} />,
  },
  { key: 'ticketMedio', label: 'Ticket médio', align: 'right', sortable: true, render: (row) => formatCurrency(row.ticketMedio) },
]

const DailyTable = ({ data }: DailyTableProps) => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Resumo diário</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">Agregado por dia no período selecionado</p>
    </div>
    <DataTable columns={columns} data={data} keyExtractor={(row) => row.data} />
  </div>
)

export default DailyTable
