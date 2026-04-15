import { useState, useMemo, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Fuel } from 'lucide-react'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import type { AbastecimentoRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface AbastecimentosTableProps {
  data: AbastecimentoRow[]
  frentistas: string[]
  combustiveis: string[]
}

const PAGE_SIZE = 20

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const fmtLitros = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' L'

const AbastecimentosTable = ({ data, frentistas, combustiveis }: AbastecimentosTableProps) => {
  const [search, setSearch] = useState('')
  const [filterFrentista, setFilterFrentista] = useState('')
  const [filterCombustivel, setFilterCombustivel] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    let result = data
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.placa.toLowerCase().includes(q) ||
          r.frentistaNome.toLowerCase().includes(q) ||
          r.combustivelNome.toLowerCase().includes(q) ||
          r.bombaDescricao.toLowerCase().includes(q) ||
          r.empresaNome.toLowerCase().includes(q)
      )
    }
    if (filterFrentista) result = result.filter((r) => r.frentistaNome === filterFrentista)
    if (filterCombustivel) result = result.filter((r) => r.combustivelNome === filterCombustivel)
    return result.sort((a, b) => b.dataHora.localeCompare(a.dataHora))
  }, [data, search, filterFrentista, filterCombustivel])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page on filter change
  const handleSearch = (v: string) => { setSearch(v); setPage(0) }
  const handleFrentista = (v: string) => { setFilterFrentista(v); setPage(0) }
  const handleCombustivel = (v: string) => { setFilterCombustivel(v); setPage(0) }

  const exportColumns: ExportColumn<AbastecimentoRow>[] = [
    { header: 'Data/Hora', accessor: (r) => r.dataHora },
    { header: 'Empresa', accessor: (r) => r.empresaNome },
    { header: 'Bomba/Bico', accessor: (r) => r.bombaDescricao },
    { header: 'Frentista', accessor: (r) => r.frentistaNome },
    { header: 'Combustível', accessor: (r) => r.combustivelNome },
    { header: 'Litros', accessor: (r) => r.litros },
    { header: 'Valor Unitário', accessor: (r) => r.valorUnitario },
    { header: 'Valor Total', accessor: (r) => r.valorTotal },
    { header: 'Preço Custo', accessor: (r) => r.precoCusto },
    { header: 'Lucro Bruto', accessor: (r) => r.lucroBruto },
    { header: 'Margem %', accessor: (r) => r.margem },
    { header: 'Placa', accessor: (r) => r.placa },
  ]

  const handleExport = useCallback(() => {
    exportToCsv('combustiveis-abastecimentos', filtered, exportColumns)
  }, [filtered])

  // Totals from filtered data
  const totalLitros = filtered.reduce((s, r) => s + r.litros, 0)
  const totalValor = filtered.reduce((s, r) => s + r.valorTotal, 0)
  const totalLucro = filtered.reduce((s, r) => s + r.lucroBruto, 0)
  const margemMedia = totalValor > 0 ? (totalLucro / totalValor) * 100 : 0

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={Fuel}
        iconColor="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-900/40"
        title="Abastecimentos"
        subtitle={`${filtered.length} de ${data.length} registros`}
        metrics={[
          { label: 'Litros', value: formatLiters(totalLitros) },
          { label: 'Valor Total', value: formatCurrency(totalValor) },
          { label: 'Margem Média', value: `${margemMedia.toFixed(1)}%`, color: margemMedia >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400' },
        ]}
      />

    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar placa, frentista, combustível..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:bg-gray-800"
          />
        </div>
        <select
          value={filterFrentista}
          onChange={(e) => handleFrentista(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">Todos os frentistas</option>
          {frentistas.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={filterCombustivel}
          onChange={(e) => handleCombustivel(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="">Todos os combustíveis</option>
          {combustiveis.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || filterFrentista || filterCombustivel) && (
          <button
            onClick={() => { setSearch(''); setFilterFrentista(''); setFilterCombustivel(''); setPage(0) }}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Limpar
          </button>
        )}
        <ExportButton onExport={handleExport} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <th className="px-4 py-2 text-left">Horário</th>
              <th className="px-4 py-2 text-left">Bomba/Bico</th>
              <th className="px-4 py-2 text-left">Frentista</th>
              <th className="px-4 py-2 text-left">Combustível</th>
              <th className="px-4 py-2 text-right">Litros</th>
              <th className="px-4 py-2 text-right">Valor unit.</th>
              <th className="px-4 py-2 text-right">Valor total</th>
              <th className="px-4 py-2 text-left">Placa</th>
              <th className="px-4 py-2 text-right">Margem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {paged.map((row, idx) => (
              <tr key={row.codigo} className={cn('text-sm text-gray-700 transition-colors hover:bg-blue-50/50 dark:text-gray-300 dark:hover:bg-gray-800/50', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{fmtDateTime(row.dataHora)}</td>
                <td className="px-4 py-2.5">{row.bombaDescricao}</td>
                <td className="px-4 py-2.5">{row.frentistaNome}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {row.combustivelNome}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fmtLitros(row.litros)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.valorUnitario)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(row.valorTotal)}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{row.placa}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    row.margem >= 10 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : row.margem >= 0 ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {row.margem.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                  Nenhum abastecimento encontrado com os filtros aplicados.
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
    </div>
  )
}

export default AbastecimentosTable
