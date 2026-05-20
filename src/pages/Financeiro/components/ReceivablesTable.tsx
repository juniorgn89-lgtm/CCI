import { useState, useMemo } from 'react'
import { TrendingUp, Search } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ReceivableRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface ReceivablesTableProps {
  data: ReceivableRow[]
}

const statusBadge = (row: ReceivableRow) => {
  if (row.statusTag === 'vencido') {
    return (
      <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
        Vencido {row.diasAtraso > 0 && `(${row.diasAtraso}d)`}
      </Badge>
    )
  }
  if (row.statusTag === 'a-vencer') {
    return (
      <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        A Vencer
      </Badge>
    )
  }
  return (
    <Badge className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
      Pago
    </Badge>
  )
}

const columns: Column<ReceivableRow>[] = [
  {
    key: 'nomeCliente',
    label: 'Cliente',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">
          {row.nomeCliente || `Cliente ${row.clienteCodigo}`}
        </p>
        {row.documento && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Doc: {row.documento}</p>
        )}
      </div>
    ),
  },
  {
    key: 'dataVencimento',
    label: 'Vencimento',
    sortable: true,
    render: (row) => (
      <span className={cn(
        row.statusTag === 'vencido' && 'font-medium text-red-600 dark:text-red-400'
      )}>
        {formatDate(row.dataVencimento)}
      </span>
    ),
  },
  {
    key: 'valor',
    label: 'Valor',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.valor)}</span>
    ),
  },
  {
    key: 'tipo',
    label: 'Tipo',
    sortable: true,
    render: (row) => (
      <span className="text-xs uppercase text-gray-500 dark:text-gray-400">{row.tipo}</span>
    ),
  },
  {
    key: 'situacaoLabel',
    label: 'Situação',
    sortable: true,
    render: (row) => statusBadge(row),
  },
]

type FilterSituacao = 'todos' | 'aberto' | 'vencido' | 'pago'

const filterOptions: { value: FilterSituacao; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'aberto', label: 'A Vencer' },
  { value: 'vencido', label: 'Vencidos' },
  { value: 'pago', label: 'Pagos' },
]

const ReceivablesTable = ({ data }: ReceivablesTableProps) => {
  const [filter, setFilter] = useState<FilterSituacao>('todos')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((row) => {
      if (filter === 'aberto' && row.statusTag !== 'a-vencer') return false
      if (filter === 'vencido' && row.statusTag !== 'vencido') return false
      if (filter === 'pago' && row.statusTag !== 'pago') return false
      if (q) {
        const cliente = (row.nomeCliente || `Cliente ${row.clienteCodigo}`).toLowerCase()
        const doc = (row.documento || '').toLowerCase()
        if (!cliente.includes(q) && !doc.includes(q)) return false
      }
      return true
    })
  }, [data, filter, search])

  const overdueCount = data.filter((r) => r.statusTag === 'vencido').length

  const totals = useMemo(() => {
    const totalValor = filtered.reduce((s, r) => s + r.valor, 0)
    const totalVencido = filtered.filter((r) => r.statusTag === 'vencido').reduce((s, r) => s + r.valor, 0)
    const totalAVencer = filtered.filter((r) => r.statusTag === 'a-vencer').reduce((s, r) => s + r.valor, 0)
    const totalPago = filtered.filter((r) => r.statusTag === 'pago').reduce((s, r) => s + r.valor, 0)
    return { totalValor, totalVencido, totalAVencer, totalPago }
  }, [filtered])

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={TrendingUp}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-100 dark:bg-emerald-900/40"
        title="Contas a Receber"
        subtitle={`${filtered.length} títulos`}
        accentGradient="bg-gradient-to-r from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-gray-900"
        metrics={[
          { label: 'Total', value: formatCurrency(totals.totalValor) },
          { label: 'A Vencer', value: formatCurrency(totals.totalAVencer), color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Vencido', value: formatCurrency(totals.totalVencido), color: 'text-red-600 dark:text-red-400' },
          { label: 'Pago', value: formatCurrency(totals.totalPago), color: 'text-green-600 dark:text-green-400' },
        ]}
      />

    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca por cliente */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="h-8 w-[200px] rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            />
          </div>
          <span className="ml-1 text-sm font-medium text-gray-600 dark:text-gray-400">Situação:</span>
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              aria-pressed={filter === opt.value}
              className={cn(
                'relative rounded-md px-3 py-1 text-sm font-medium transition-colors',
                filter === opt.value
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              {opt.label}
              {opt.value === 'vencido' && overdueCount > 0 && filter !== 'vencido' && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-100 px-1 text-[10px] font-bold text-red-600 dark:bg-red-900/50 dark:text-red-400">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <DataTable columns={columns} data={filtered} keyExtractor={(row) => row.codigo} />
      </div>
    </div>
    </div>
  )
}

export default ReceivablesTable
