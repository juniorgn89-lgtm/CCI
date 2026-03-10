import { useState, useMemo, useCallback } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import useStockAnalysis from '@/pages/Estoques/hooks/useStockAnalysis'
import type { StockAnalysisRow } from '@/pages/Estoques/hooks/useStockAnalysis'

type SortKey = 'produtoNome' | 'categoria' | 'estoque' | 'mediaMes' | 'necessidade' | 'giro' | 'estoqueMedio'
type SortDir = 'asc' | 'desc'
type ViewFilter = 'all' | 'need'

const PAGE_SIZE = 20

const AnalysisSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="mb-4 flex items-center gap-3">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Calculando análise de estoque (vendas dos últimos 6 meses)...
      </p>
    </div>
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const formatDecimal = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const StockAnalysis = () => {
  const { rows, categorias, isLoading } = useStockAnalysis()

  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('necessidade')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleFilterChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(0)
  }

  const filtered = useMemo(() => {
    let result: StockAnalysisRow[] = rows

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.produtoNome.toLowerCase().includes(q) ||
          String(r.produtoCodigo).includes(q)
      )
    }

    if (categoriaFilter) {
      result = result.filter((r) => r.categoria === categoriaFilter)
    }

    if (viewFilter === 'need') {
      result = result.filter((r) => r.necessidade > 0)
    }

    // Sort
    const numericKeys: SortKey[] = ['estoque', 'mediaMes', 'necessidade', 'giro', 'estoqueMedio']
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (numericKeys.includes(sortKey)) {
        cmp = (a[sortKey] as number) - (b[sortKey] as number)
      } else {
        cmp = (a[sortKey] as string).localeCompare(b[sortKey] as string, 'pt-BR')
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [rows, search, categoriaFilter, viewFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safeCurrentPage * PAGE_SIZE, (safeCurrentPage + 1) * PAGE_SIZE)

  const csvColumns: ExportColumn<StockAnalysisRow>[] = [
    { header: 'Produto', accessor: (r) => r.produtoNome },
    { header: 'Código', accessor: (r) => r.produtoCodigo },
    { header: 'Categoria', accessor: (r) => r.categoria },
    { header: 'Estoque', accessor: (r) => r.estoque },
    { header: 'Média Mês', accessor: (r) => r.mediaMes },
    { header: 'Necessidade', accessor: (r) => r.necessidade },
    { header: 'Giro', accessor: (r) => r.giro },
    { header: 'Estoque Médio', accessor: (r) => r.estoqueMedio },
  ]

  const handleExport = useCallback(() => {
    exportToCsv('estoque-analise', filtered, csvColumns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, csvColumns])

  if (isLoading) return <AnalysisSkeleton />

  const SortHeader = ({ label, colKey, align = 'left' }: { label: string; colKey: SortKey; align?: 'left' | 'right' }) => (
    <th
      className={cn(
        'cursor-pointer select-none px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
        align === 'right' ? 'text-right' : 'text-left'
      )}
      onClick={() => handleSort(colKey)}
    >
      <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
        {label}
        {sortKey === colKey && (
          <span className="text-blue-500">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </div>
    </th>
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Análise de Estoque</h3>
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

          <ExportButton onExport={handleExport} />

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleFilterChange(setViewFilter)('all' as ViewFilter)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                viewFilter === 'all'
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              Todos os produtos
            </button>
            <button
              onClick={() => handleFilterChange(setViewFilter)('need' as ViewFilter)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                viewFilter === 'need'
                  ? 'bg-orange-600 text-white dark:bg-orange-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              Necessidade de compra
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
              <SortHeader label="Produto" colKey="produtoNome" />
              <SortHeader label="Categoria" colKey="categoria" />
              <SortHeader label="Estoque" colKey="estoque" align="right" />
              <SortHeader label="Média Mês" colKey="mediaMes" align="right" />
              <SortHeader label="Necessidade" colKey="necessidade" align="right" />
              <SortHeader label="Giro" colKey="giro" align="right" />
              <SortHeader label="Estoque Médio" colKey="estoqueMedio" align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {paged.map((row) => (
              <tr
                key={row.produtoCodigo}
                className="transition-colors hover:bg-blue-50/30 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.produtoNome}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">#{row.produtoCodigo}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{row.categoria}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatNumber(row.estoque)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                    {formatDecimal(row.mediaMes)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums',
                      row.necessidade > 0
                        ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {formatDecimal(row.necessidade)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                    {formatDecimal(row.giro)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                    {formatDecimal(row.estoqueMedio)}
                  </span>
                </td>
              </tr>
            ))}

            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
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
            Mostrando {safeCurrentPage * PAGE_SIZE + 1}&ndash;{Math.min((safeCurrentPage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
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

export default StockAnalysis
