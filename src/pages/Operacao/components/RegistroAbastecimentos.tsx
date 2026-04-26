import { useState, useMemo, useCallback } from 'react'
import { Search, Fuel } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import ExportButton from '@/components/tables/ExportButton'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface RegistroAbastecimentosProps {
  abastecimentoRows: AbastecimentoRow[]
  combustiveisList: { codigo: number; nome: string }[]
}

const fmtDateTime = (dt: string) => {
  if (!dt) return '-'
  const d = dt.substring(0, 10)
  const t = dt.substring(11, 16)
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y} ${t}`
}

const columns: Column<AbastecimentoRow>[] = [
  { key: 'dataHora', label: 'Data/Hora', sortable: true, render: (r) => fmtDateTime(r.dataHora) },
  { key: 'frentistaNome', label: 'Frentista', sortable: true },
  { key: 'produtoNome', label: 'Combustível', sortable: true },
  {
    key: 'litros', label: 'Litros', align: 'right', sortable: true,
    render: (r) => <span className="tabular-nums">{formatNumber(r.litros)}</span>,
  },
  {
    key: 'valorTotal', label: 'Valor Total', align: 'right', sortable: true,
    render: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.valorTotal)}</span>,
  },
]

const csvCols: ExportColumn<AbastecimentoRow>[] = [
  { header: 'Data/Hora', accessor: (r) => r.dataHora },
  { header: 'Frentista', accessor: (r) => r.frentistaNome },
  { header: 'Combustível', accessor: (r) => r.produtoNome },
  { header: 'Litros', accessor: (r) => r.litros },
  { header: 'Valor Total', accessor: (r) => r.valorTotal },
]

const RegistroAbastecimentos = ({ abastecimentoRows, combustiveisList }: RegistroAbastecimentosProps) => {
  const [search, setSearch] = useState('')
  const [combustivel, setCombustivel] = useState<number | null>(null)

  const filtered = useMemo(() => {
    let result = abastecimentoRows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) => r.frentistaNome.toLowerCase().includes(q) || r.produtoNome.toLowerCase().includes(q)
      )
    }
    if (combustivel !== null) {
      result = result.filter((r) => Number(r.produtoCodigo) === combustivel)
    }
    return result
  }, [abastecimentoRows, search, combustivel])

  const handleExport = useCallback(() => {
    exportToCsv('operacao-abastecimentos', filtered, csvCols)
  }, [filtered])

  // Summary
  const totalLitros = filtered.reduce((s, r) => s + r.litros, 0)
  const totalValor = filtered.reduce((s, r) => s + r.valorTotal, 0)

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={Fuel}
        iconColor="text-indigo-600"
        iconBg="bg-indigo-100 dark:bg-indigo-900/40"
        title="Abastecimentos"
        subtitle={`${filtered.length} de ${abastecimentoRows.length} registros`}
        accentGradient="bg-gradient-to-r from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-gray-900"
        metrics={[
          { label: 'Litros', value: formatLiters(totalLitros) },
          { label: 'Valor Total', value: formatCurrency(totalValor) },
        ]}
      />

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar frentista ou combustível..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Combustível filter */}
          <select
            value={combustivel ?? ''}
            onChange={(e) => setCombustivel(e.target.value ? Number(e.target.value) : null)}
            className={cn(
              'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
              combustivel !== null ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
            )}
          >
            <option value="">Todos os combustíveis</option>
            {combustiveisList.map((c) => (
              <option key={c.codigo} value={c.codigo}>{c.nome}</option>
            ))}
          </select>

          {(search || combustivel !== null) && (
            <button
              onClick={() => { setSearch(''); setCombustivel(null) }}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Limpar
            </button>
          )}
          <ExportButton onExport={handleExport} />
        </div>

        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Nenhum abastecimento encontrado.
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.codigo} />
        )}

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {abastecimentoRows.length} registros
        </div>
      </div>
    </div>
  )
}

export default RegistroAbastecimentos
