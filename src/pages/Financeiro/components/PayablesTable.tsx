import { useState, useCallback, useMemo } from 'react'
import { TrendingDown } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import ExportButton from '@/components/tables/ExportButton'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import { cn } from '@/lib/utils'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface PayablesTableProps {
  data: PayableRow[]
}

const statusBadge = (row: PayableRow) => {
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
  if (row.statusTag === 'cancelado') {
    return (
      <Badge className="border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        Cancelado
      </Badge>
    )
  }
  return (
    <Badge className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
      Pago
    </Badge>
  )
}

const columns: Column<PayableRow>[] = [
  {
    key: 'nomeFornecedor',
    label: 'Fornecedor',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">
          {row.nomeFornecedor || `Fornecedor ${row.fornecedorCodigo}`}
        </p>
        {row.descricao && (
          <p className="max-w-[250px] truncate text-xs text-gray-400 dark:text-gray-500">{row.descricao}</p>
        )}
      </div>
    ),
  },
  {
    key: 'vencimento',
    label: 'Vencimento',
    sortable: true,
    render: (row) => (
      <span className={cn(
        row.statusTag === 'vencido' && 'font-medium text-red-600 dark:text-red-400'
      )}>
        {formatDate(row.vencimento)}
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
    key: 'saldoRestante',
    label: 'Saldo',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={cn(
        'tabular-nums',
        row.saldoRestante > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
      )}>
        {formatCurrency(row.saldoRestante)}
      </span>
    ),
  },
  {
    key: 'parcela',
    label: 'Parcela',
    sortable: false,
    render: (row) =>
      row.quantidadeParcelas > 1 ? (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.parcela}/{row.quantidadeParcelas}
        </span>
      ) : (
        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
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

const csvExportColumns: ExportColumn<PayableRow>[] = [
  { header: 'Fornecedor', accessor: (r) => r.nomeFornecedor || `Fornecedor ${r.fornecedorCodigo}` },
  { header: 'Descrição', accessor: (r) => r.descricao },
  { header: 'Vencimento', accessor: (r) => r.vencimento },
  { header: 'Valor', accessor: (r) => r.valor },
  { header: 'Valor Pago', accessor: (r) => r.valorPago },
  { header: 'Saldo Restante', accessor: (r) => r.saldoRestante },
  { header: 'Parcela', accessor: (r) => r.quantidadeParcelas > 1 ? `${r.parcela}/${r.quantidadeParcelas}` : '' },
  { header: 'Situação', accessor: (r) => r.situacaoLabel },
  { header: 'Dias Atraso', accessor: (r) => r.diasAtraso },
]

const filterOptions: { value: FilterSituacao; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'aberto', label: 'A Vencer' },
  { value: 'vencido', label: 'Vencidos' },
  { value: 'pago', label: 'Pagos' },
]

const PayablesTable = ({ data }: PayablesTableProps) => {
  const [filter, setFilter] = useState<FilterSituacao>('todos')

  const filtered = data.filter((row) => {
    if (filter === 'aberto') return row.statusTag === 'a-vencer'
    if (filter === 'vencido') return row.statusTag === 'vencido'
    if (filter === 'pago') return row.statusTag === 'pago'
    return true
  })

  const handleExport = useCallback(() => {
    exportToCsv('financeiro-pagar', filtered, csvExportColumns)
  }, [filtered])

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
        icon={TrendingDown}
        iconColor="text-red-600"
        iconBg="bg-red-100 dark:bg-red-900/40"
        title="Contas a Pagar"
        subtitle={`${filtered.length} títulos`}
        accentGradient="bg-gradient-to-r from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900"
        metrics={[
          { label: 'Total', value: formatCurrency(totals.totalValor) },
          { label: 'A Vencer', value: formatCurrency(totals.totalAVencer), color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Vencido', value: formatCurrency(totals.totalVencido), color: 'text-red-600 dark:text-red-400' },
          { label: 'Pago', value: formatCurrency(totals.totalPago), color: 'text-green-600 dark:text-green-400' },
        ]}
      />

    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Situação:</span>
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
          <ExportButton onExport={handleExport} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <DataTable columns={columns} data={filtered} keyExtractor={(row) => row.codigo} />
      </div>
    </div>
    </div>
  )
}

export default PayablesTable
