import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { formatNumber, formatDate } from '@/lib/formatters'
import type { MovementRow } from '@/pages/Estoques/hooks/useStockData'

interface StockHistoryProps {
  data: MovementRow[]
}

const PAGE_SIZE = 15

const StockHistory = ({ data }: StockHistoryProps) => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(
      (r) =>
        r.produtoNome.toLowerCase().includes(q) ||
        String(r.codigoProduto).includes(q)
    )
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safeCurrentPage * PAGE_SIZE, (safeCurrentPage + 1) * PAGE_SIZE)

  const formatPeriod = (dt: string) => {
    // API returns "MM-yyyy" (e.g. "03-2026") or ISO date
    if (dt.includes('T')) {
      const dateStr = dt.split('T')[0]
      const timeStr = dt.split('T')[1]?.slice(0, 5) ?? ''
      return { date: formatDate(dateStr), time: timeStr }
    }
    // MM-yyyy format
    const [month, year] = dt.split('-')
    return { date: `${month}/${year}`, time: '' }
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <Clock className="h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
          Sem histórico de movimentações no período
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Histórico de Movimentações</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {filtered.length} registros
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="h-8 rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:ring-1 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:placeholder:text-gray-500 dark:focus:border-blue-600 dark:focus:bg-gray-800"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Produto
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Quantidade
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Data / Hora
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {paged.map((row, i) => {
              const { date, time } = formatPeriod(row.dataMovimento)
              const isPositive = row.quantidade > 0
              return (
                <tr
                  key={`${row.codigoProduto}-${row.dataMovimento}-${i}`}
                  className="transition-colors hover:bg-blue-50/30 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.produtoNome}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">#{row.codigoProduto}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold tabular-nums ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isPositive ? '+' : ''}{formatNumber(row.quantidade)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{date}</p>
                    {time && <p className="text-xs text-gray-400 dark:text-gray-500">{time}</p>}
                  </td>
                </tr>
              )
            })}

            {paged.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                  Nenhuma movimentação encontrada
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

export default StockHistory
