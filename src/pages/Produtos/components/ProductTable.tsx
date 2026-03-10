import { useState, useMemo, useCallback } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import type { ProductRow } from '@/pages/Produtos/hooks/useProductData'

interface ProductTableProps {
  data: ProductRow[]
  grupos: string[]
}

const PAGE_SIZE = 20

const ProductTable = ({ data, grupos }: ProductTableProps) => {
  const [search, setSearch] = useState('')
  const [filterGrupo, setFilterGrupo] = useState('')
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [sortKey, setSortKey] = useState<keyof ProductRow>('faturamento')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => {
    let result = data
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.nome.toLowerCase().includes(q) ||
          r.grupo.toLowerCase().includes(q) ||
          String(r.produtoCodigo).includes(q)
      )
    }
    if (filterGrupo) result = result.filter((r) => r.grupo === filterGrupo)
    return [...result].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal
      }
      return sortDir === 'desc'
        ? String(bVal).localeCompare(String(aVal), 'pt-BR')
        : String(aVal).localeCompare(String(bVal), 'pt-BR')
    })
  }, [data, search, filterGrupo, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSearch = (v: string) => { setSearch(v); setPage(0) }
  const handleGrupo = (v: string) => { setFilterGrupo(v); setPage(0) }

  const handleSort = (key: keyof ProductRow) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const csvColumns: ExportColumn<ProductRow>[] = [
    { header: 'Produto', accessor: (r) => r.nome },
    { header: 'Grupo', accessor: (r) => r.grupo },
    { header: 'Código', accessor: (r) => r.produtoCodigo },
    { header: 'Quantidade', accessor: (r) => r.quantidade },
    { header: 'Faturamento', accessor: (r) => r.faturamento },
    { header: 'Custo', accessor: (r) => r.custo },
    { header: 'Lucro Bruto', accessor: (r) => r.lucroBruto },
    { header: 'Margem %', accessor: (r) => r.margemPct },
    { header: 'Preço Médio Venda', accessor: (r) => r.precoMedioVenda },
    { header: 'Preço Custo Médio', accessor: (r) => r.precoCustoMedio },
  ]

  const handleExport = useCallback(() => {
    exportToCsv('produtos-vendidos', filtered, csvColumns)
  }, [filtered])

  const SortHeader = ({ label, field }: { label: string; field: keyof ProductRow }) => (
    <th
      className="cursor-pointer px-4 py-3 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === field && (
          <span className="text-blue-500">{sortDir === 'desc' ? '↓' : '↑'}</span>
        )}
      </div>
    </th>
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Produtos vendidos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filtered.length.toLocaleString('pt-BR')} produtos encontrados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto, grupo, código..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:bg-gray-800"
              />
            </div>
            <ExportButton onExport={handleExport} />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'relative flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
                showFilters || filterGrupo
                  ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              )}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {filterGrupo && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">1</span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <select
              value={filterGrupo}
              onChange={(e) => handleGrupo(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">Todos os grupos</option>
              {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {filterGrupo && (
              <button
                onClick={() => { setFilterGrupo(''); setPage(0) }}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <SortHeader label="Produto" field="nome" />
              <SortHeader label="Grupo" field="grupo" />
              <th className="px-4 py-3 text-right">Código</th>
              <SortHeader label="Qtd" field="quantidade" />
              <SortHeader label="Faturamento" field="faturamento" />
              <SortHeader label="Lucro bruto" field="lucroBruto" />
              <SortHeader label="Margem" field="margemPct" />
              <SortHeader label="Preço médio" field="precoMedioVenda" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {paged.map((row) => (
              <tr key={row.produtoCodigo} className="text-sm text-gray-700 transition-colors hover:bg-blue-50/50 dark:text-gray-300 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium">{row.nome}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {row.grupo}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs tabular-nums">{row.produtoCodigo}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(row.quantidade)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.faturamento)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  <span className={cn('font-medium', row.lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                    {formatCurrency(row.lucroBruto)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    row.margemPct >= 20 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : row.margemPct >= 0 ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {row.margemPct.toFixed(1)}%
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.precoMedioVenda)}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                  Nenhum produto encontrado com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductTable
