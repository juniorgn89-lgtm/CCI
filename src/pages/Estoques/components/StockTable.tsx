import { useState, useMemo, useCallback } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import type { StockRow } from '@/pages/Estoques/hooks/useStockData'

interface StockTableProps {
  data: StockRow[]
  categorias: string[]
}

type SortKey = 'produtoNome' | 'categoria' | 'codigoSku' | 'local' | 'saldo' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_CONFIG = {
  normal: { label: 'Normal', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  baixo: { label: 'Baixo', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  critico: { label: 'Crítico', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  sem_estoque: { label: 'Sem estoque', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  negativo: { label: 'Negativo', bg: 'bg-red-100 dark:bg-red-950/50', text: 'text-red-900 dark:text-red-300', dot: 'bg-red-800 dark:bg-red-600' },
} as const

const PAGE_SIZE = 20

const StatusBadge = ({ status }: { status: StockRow['status'] }) => {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const StockTable = ({ data, categorias }: StockTableProps) => {
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('produtoNome')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = data

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.produtoNome.toLowerCase().includes(q) ||
          r.codigoSku.toLowerCase().includes(q) ||
          String(r.produtoCodigo).includes(q)
      )
    }

    if (categoriaFilter) {
      result = result.filter((r) => r.categoria === categoriaFilter)
    }

    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter)
    }

    // Sort
    const statusOrder = { negativo: 0, sem_estoque: 1, critico: 2, baixo: 3, normal: 4 }
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'saldo') {
        cmp = a.saldo - b.saldo
      } else if (sortKey === 'status') {
        cmp = statusOrder[a.status] - statusOrder[b.status]
      } else {
        cmp = (a[sortKey] as string).localeCompare(b[sortKey] as string, 'pt-BR')
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [data, search, categoriaFilter, statusFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safeCurrentPage * PAGE_SIZE, (safeCurrentPage + 1) * PAGE_SIZE)

  // Reset page when filters change
  const handleFilterChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(0)
  }

  const csvColumns: ExportColumn<StockRow>[] = [
    { header: 'Produto', accessor: (r) => r.produtoNome },
    { header: 'Código', accessor: (r) => r.produtoCodigo },
    { header: 'Categoria', accessor: (r) => r.categoria },
    { header: 'SKU', accessor: (r) => r.codigoSku },
    { header: 'Local', accessor: (r) => r.local },
    { header: 'Saldo', accessor: (r) => r.saldo },
    { header: 'Status', accessor: (r) => r.status },
  ]

  const handleExport = useCallback(() => {
    exportToCsv('estoque-posicao', filtered, csvColumns)
  }, [filtered])

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <th
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      onClick={() => handleSort(colKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === colKey && (
          <span className="text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Posição de Estoque</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {filtered.length} itens
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => handleFilterChange(setSearch)(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:ring-1 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-blue-600 dark:focus:bg-gray-800"
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <select
              value={categoriaFilter}
              onChange={(e) => handleFilterChange(setCategoriaFilter)(e.target.value)}
              className="h-8 appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-6 text-xs text-gray-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-1 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:border-blue-600"
            >
              <option value="">Todas categorias</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}
            className="h-8 appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-1 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:border-blue-600"
          >
            <option value="">Todos os status</option>
            <option value="normal">Normal</option>
            <option value="baixo">Baixo</option>
            <option value="critico">Crítico</option>
            <option value="sem_estoque">Sem estoque</option>
            <option value="negativo">Negativo</option>
          </select>
          {(search || categoriaFilter || statusFilter) && (
            <button
              onClick={() => { setSearch(''); setCategoriaFilter(''); setStatusFilter(''); setPage(0) }}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Limpar
            </button>
          )}
          <ExportButton onExport={handleExport} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
              <SortHeader label="Produto" colKey="produtoNome" />
              <SortHeader label="Categoria" colKey="categoria" />
              <SortHeader label="SKU" colKey="codigoSku" />
              <SortHeader label="Local" colKey="local" />
              <th
                className="cursor-pointer select-none px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => handleSort('saldo')}
              >
                <div className="flex items-center justify-end gap-1">
                  Saldo
                  {sortKey === 'saldo' && (
                    <span className="text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <SortHeader label="Status" colKey="status" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {paged.map((row, i) => (
              <tr
                key={`${row.produtoCodigo}-${row.estoqueCodigo}-${i}`}
                className={cn(
                  'transition-colors hover:bg-blue-50/30 dark:hover:bg-gray-800/50',
                  row.status === 'negativo' && 'bg-red-100/30 dark:bg-red-950/20',
                  row.status === 'sem_estoque' && 'bg-red-50/20 dark:bg-red-950/10',
                  row.status === 'critico' && 'bg-orange-50/20 dark:bg-orange-950/10'
                )}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.produtoNome}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">#{row.produtoCodigo}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{row.categoria}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{row.codigoSku}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{row.local}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    row.saldo <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                  )}>
                    {formatNumber(row.saldo)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}

            {paged.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                  Nenhum produto encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mostrando {safeCurrentPage * PAGE_SIZE + 1}–{Math.min((safeCurrentPage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safeCurrentPage === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-medium text-gray-700 dark:text-gray-300">
              {safeCurrentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safeCurrentPage >= totalPages - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockTable
