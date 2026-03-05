import DataTable, { type Column } from '@/components/tables/DataTable'
import { formatNumber } from '@/lib/formatters'
import type { StockRow } from '@/pages/Estoques/hooks/useStockData'

interface StockTableProps {
  data: StockRow[]
}

const columns: Column<StockRow>[] = [
  {
    key: 'produtoCodigo',
    label: 'Produto',
    sortable: true,
    render: (row) => `Produto ${row.produtoCodigo}`,
  },
  {
    key: 'estoqueNome',
    label: 'Estoque',
    sortable: true,
  },
  {
    key: 'saldo',
    label: 'Saldo',
    align: 'right',
    sortable: true,
    render: (row) => formatNumber(row.saldo),
  },
]

const StockTable = ({ data }: StockTableProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => `${row.produtoCodigo}-${row.estoqueCodigo}`}
      />
    </div>
  )
}

export default StockTable
