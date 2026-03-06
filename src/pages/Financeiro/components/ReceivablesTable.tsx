import { useState } from 'react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { TituloReceber } from '@/api/types/financeiro'

interface ReceivableRow extends TituloReceber {
  situacaoLabel: string
  [key: string]: unknown
}

interface ReceivablesTableProps {
  data: ReceivableRow[]
}

const columns: Column<ReceivableRow>[] = [
  {
    key: 'nomeCliente',
    label: 'Cliente',
    sortable: true,
    render: (row) => row.nomeCliente || `Cliente ${row.clienteCodigo}`,
  },
  {
    key: 'dataVencimento',
    label: 'Vencimento',
    sortable: true,
    render: (row) => formatDate(row.dataVencimento),
  },
  {
    key: 'valor',
    label: 'Valor',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.valor),
  },
  {
    key: 'situacaoLabel',
    label: 'Situação',
    sortable: true,
    render: (row) => (
      <HeatmapCell
        value={row.pendente ? -1 : 1}
        min={-1}
        max={1}
        formatted={row.situacaoLabel}
      />
    ),
  },
]

type FilterSituacao = 'todos' | 'aberto' | 'pago'

const ReceivablesTable = ({ data }: ReceivablesTableProps) => {
  const [filter, setFilter] = useState<FilterSituacao>('todos')

  const filtered = data.filter((row) => {
    if (filter === 'aberto') return row.pendente
    if (filter === 'pago') return !row.pendente
    return true
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
        <span className="text-sm font-medium text-gray-600">Situação:</span>
        {(['todos', 'aberto', 'pago'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            aria-pressed={filter === opt}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              filter === opt
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {opt === 'todos' ? 'Todos' : opt === 'aberto' ? 'Aberto' : 'Pago'}
          </button>
        ))}
      </div>
      <DataTable columns={columns} data={filtered} keyExtractor={(row) => row.codigo} />
    </div>
  )
}

export default ReceivablesTable
