import { useState, useCallback, useMemo } from 'react'
import { AlertTriangle, Package, Search } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import ExportButton from '@/components/tables/ExportButton'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { StockItem } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface StockViewProps {
  stockItems: StockItem[]
  stockSummary: {
    totalItens: number
    valorTotal: number
    baixoEstoque: number
    zerado: number
  }
}

const statusLabel: Record<string, { label: string; classes: string }> = {
  normal: { label: 'Normal', classes: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
  baixo: { label: 'Baixo', classes: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  zerado: { label: 'Zerado', classes: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
}

const columns: Column<StockItem>[] = [
  { key: 'nome', label: 'Produto', sortable: true },
  { key: 'grupo', label: 'Grupo', sortable: true },
  {
    key: 'saldo', label: 'Estoque Atual', align: 'right', sortable: true,
    render: (r) => (
      <span className={cn(
        'tabular-nums font-medium',
        r.status === 'zerado' ? 'text-red-600 dark:text-red-400' : r.status === 'baixo' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'
      )}>
        {formatNumber(r.saldo)}
      </span>
    ),
  },
  {
    key: 'custoMedio', label: 'Custo Médio', align: 'right', sortable: true,
    render: (r) => formatCurrency(r.custoMedio),
  },
  {
    key: 'valorEstoque', label: 'Valor em Estoque', align: 'right', sortable: true,
    render: (r) => formatCurrency(r.valorEstoque),
  },
  {
    key: 'status', label: 'Status', align: 'center', sortable: true,
    render: (r) => {
      const s = statusLabel[r.status]
      return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', s.classes)}>
          {r.status !== 'normal' && <AlertTriangle className="h-3 w-3" />}
          {s.label}
        </span>
      )
    },
  },
]

const csvCols: ExportColumn<StockItem>[] = [
  { header: 'Código', accessor: (r) => r.produtoCodigo },
  { header: 'Produto', accessor: (r) => r.nome },
  { header: 'Grupo', accessor: (r) => r.grupo },
  { header: 'Estoque Atual', accessor: (r) => r.saldo },
  { header: 'Custo Médio', accessor: (r) => r.custoMedio },
  { header: 'Valor Estoque', accessor: (r) => r.valorEstoque },
  { header: 'Status', accessor: (r) => r.status },
]

type FilterStatus = 'todos' | 'normal' | 'baixo' | 'zerado'

const StockView = ({ stockItems, stockSummary }: StockViewProps) => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('todos')

  const filtered = useMemo(() => {
    let result = stockItems
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((i) => i.nome.toLowerCase().includes(q) || i.grupo.toLowerCase().includes(q))
    }
    if (statusFilter !== 'todos') {
      result = result.filter((i) => i.status === statusFilter)
    }
    return result
  }, [stockItems, search, statusFilter])

  const handleExport = useCallback(() => {
    exportToCsv('conveniencia-estoque', filtered, csvCols)
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Itens em Estoque</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatNumber(stockSummary.totalItens)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor Total</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(stockSummary.valorTotal)}
          </p>
        </div>
        <button
          onClick={() => setStatusFilter(statusFilter === 'baixo' ? 'todos' : 'baixo')}
          className={cn(
            'rounded-lg border p-4 text-left transition-all',
            statusFilter === 'baixo'
              ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Estoque Baixo</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {stockSummary.baixoEstoque}
          </p>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'zerado' ? 'todos' : 'zerado')}
          className={cn(
            'rounded-lg border p-4 text-left transition-all',
            statusFilter === 'zerado'
              ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Estoque Zerado</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {stockSummary.zerado}
          </p>
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="flex gap-1">
            {(['todos', 'normal', 'baixo', 'zerado'] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  statusFilter === s
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                )}
              >
                {s === 'todos' ? 'Todos' : s === 'normal' ? 'Normal' : s === 'baixo' ? 'Baixo' : 'Zerado'}
              </button>
            ))}
          </div>

          {(search || statusFilter !== 'todos') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('todos') }}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Limpar
            </button>
          )}

          <ExportButton onExport={handleExport} />
        </div>

        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Nenhum item encontrado.
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} />
        )}

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {stockItems.length} itens
        </div>
      </div>
    </div>
  )
}

export default StockView
