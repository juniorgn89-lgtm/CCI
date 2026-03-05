import DataTable, { type Column } from '@/components/tables/DataTable'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { AbcRow } from '@/pages/Produtos/hooks/useProductData'

interface AbcCurveProps {
  data: AbcRow[]
}

const AbcBadge = ({ classificacao }: { classificacao: 'A' | 'B' | 'C' }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        classificacao === 'A' && 'bg-green-100 text-green-700',
        classificacao === 'B' && 'bg-yellow-100 text-yellow-700',
        classificacao === 'C' && 'bg-red-100 text-red-700'
      )}
    >
      {classificacao}
    </span>
  )
}

const columns: Column<AbcRow>[] = [
  {
    key: 'classificacao',
    label: 'Classe',
    sortable: true,
    render: (row) => <AbcBadge classificacao={row.classificacao} />,
  },
  {
    key: 'nome',
    label: 'Produto',
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
    key: 'acumuladoPct',
    label: '% Acumulado',
    align: 'right',
    sortable: true,
    render: (row) => `${row.acumuladoPct.toFixed(1)}%`,
  },
]

const AbcCurve = ({ data }: AbcCurveProps) => {
  const countA = data.filter((r) => r.classificacao === 'A').length
  const countB = data.filter((r) => r.classificacao === 'B').length
  const countC = data.filter((r) => r.classificacao === 'C').length

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2">
          <AbcBadge classificacao="A" />
          <span className="text-sm text-gray-700">{countA} itens (80% do faturamento)</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2">
          <AbcBadge classificacao="B" />
          <span className="text-sm text-gray-700">{countB} itens (80-95%)</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
          <AbcBadge classificacao="C" />
          <span className="text-sm text-gray-700">{countC} itens (95-100%)</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DataTable columns={columns} data={data} keyExtractor={(row) => row.produtoCodigo} />
      </div>
    </div>
  )
}

export default AbcCurve
