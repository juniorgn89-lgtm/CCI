import { useState, useMemo, useCallback } from 'react'
import { Search } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import type { AbcRow } from '@/pages/Produtos/hooks/useProductData'

interface AbcCurveProps {
  data: AbcRow[]
}

const AbcBadge = ({ classificacao }: { classificacao: 'A' | 'B' | 'C' }) => (
  <span
    className={cn(
      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
      classificacao === 'A' && 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
      classificacao === 'B' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
      classificacao === 'C' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    )}
  >
    {classificacao}
  </span>
)

const AbcCurve = ({ data }: AbcCurveProps) => {
  const [filterClass, setFilterClass] = useState<'A' | 'B' | 'C' | ''>('')
  const [search, setSearch] = useState('')

  const countA = data.filter((r) => r.classificacao === 'A').length
  const countB = data.filter((r) => r.classificacao === 'B').length
  const countC = data.filter((r) => r.classificacao === 'C').length

  const fatA = data.filter((r) => r.classificacao === 'A').reduce((s, r) => s + r.faturamento, 0)
  const fatB = data.filter((r) => r.classificacao === 'B').reduce((s, r) => s + r.faturamento, 0)
  const fatC = data.filter((r) => r.classificacao === 'C').reduce((s, r) => s + r.faturamento, 0)

  const filtered = useMemo(() => {
    let result = data
    if (filterClass) result = result.filter((r) => r.classificacao === filterClass)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) => r.nome.toLowerCase().includes(q) || r.grupo.toLowerCase().includes(q))
    }
    return result
  }, [data, filterClass, search])

  const csvColumns: ExportColumn<AbcRow>[] = [
    { header: 'Classe', accessor: (r) => r.classificacao },
    { header: 'Produto', accessor: (r) => r.nome },
    { header: 'Grupo', accessor: (r) => r.grupo },
    { header: 'Quantidade', accessor: (r) => r.quantidade },
    { header: 'Faturamento', accessor: (r) => r.faturamento },
    { header: '% Acumulado', accessor: (r) => r.acumuladoPct },
  ]

  const handleExport = useCallback(() => {
    exportToCsv('produtos-curva-abc', filtered, csvColumns)
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {([
          { cls: 'A' as const, count: countA, fat: fatA, label: '≤ 80% do faturamento', cardBg: 'bg-gradient-to-br from-green-50/60 to-white dark:from-green-950/20 dark:to-gray-900', iconBg: 'bg-green-100 dark:bg-green-900/30' },
          { cls: 'B' as const, count: countB, fat: fatB, label: '80% — 95%', cardBg: 'bg-gradient-to-br from-yellow-50/60 to-white dark:from-yellow-950/20 dark:to-gray-900', iconBg: 'bg-yellow-100 dark:bg-yellow-900/30' },
          { cls: 'C' as const, count: countC, fat: fatC, label: '95% — 100%', cardBg: 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900', iconBg: 'bg-red-100 dark:bg-red-900/30' },
        ]).map((item) => (
          <button
            key={item.cls}
            onClick={() => setFilterClass(filterClass === item.cls ? '' : item.cls)}
            className={cn(
              'rounded-lg border border-gray-200/60 px-3 py-2.5 text-left transition-all dark:border-gray-700/60',
              item.cardBg,
              filterClass === item.cls && 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950'
            )}
          >
            <div className="flex items-center justify-between">
              <AbcBadge classificacao={item.cls} />
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{item.count}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(item.fat)}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:bg-gray-800"
              />
            </div>
            <ExportButton onExport={handleExport} />
            <span className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} produtos</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-3 text-center">Classe</th>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Grupo</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
                <th className="px-4 py-3 text-right">Faturamento</th>
                <th className="px-4 py-3 text-right">% Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((row) => (
                <tr key={row.produtoCodigo} className="text-sm text-gray-700 transition-colors hover:bg-blue-50/50 dark:text-gray-300 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 text-center"><AbcBadge classificacao={row.classificacao} /></td>
                  <td className="px-4 py-2.5 font-medium">{row.nome}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{row.grupo}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(row.quantidade)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.faturamento)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{row.acumuladoPct.toFixed(1)}%</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AbcCurve
