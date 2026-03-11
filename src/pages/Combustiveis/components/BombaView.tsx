import { useCallback, useMemo } from 'react'
import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatLiters, formatLitersShort, formatNumber } from '@/lib/formatters'
import DataTable, { type Column } from '@/components/tables/DataTable'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import type { BombaRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface BombaViewProps {
  data: BombaRow[]
}

const csvColumns: ExportColumn<BombaRow>[] = [
  { header: '#', accessor: (_, i) => (i ?? 0) + 1 },
  { header: 'Score', accessor: (r) => r.score.toFixed(1) },
  { header: 'Bico', accessor: (r) => r.bicoDescricao },
  { header: 'Combustivel', accessor: (r) => r.combustivelNome },
  { header: 'Receita', accessor: (r) => r.receita },
  { header: 'Litros', accessor: (r) => r.litros },
  { header: 'Abastecimentos', accessor: (r) => r.totalAbastecimentos },
  { header: 'Ticket Medio', accessor: (r) => r.ticketMedio },
  { header: 'Margem %', accessor: (r) => r.margem },
]

/* ── Podium colors ─────────────────────────────────────── */

const PODIUM = [
  { border: 'border-amber-400', label: '1o Lugar' },
  { border: 'border-gray-400', label: '2o Lugar' },
  { border: 'border-orange-400', label: '3o Lugar' },
]

/* ── Score badge ───────────────────────────────────────── */

const ScoreBadge = ({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) => {
  const bg = score >= 75
    ? 'bg-emerald-500'
    : score >= 50
      ? 'bg-blue-500'
      : score >= 25
        ? 'bg-amber-500'
        : 'bg-gray-400'
  const dim = size === 'md' ? 'h-10 w-10 text-base' : 'h-7 w-7 text-xs'

  return (
    <div className={cn('flex items-center justify-center rounded-full font-bold tabular-nums text-white shadow-sm', bg, dim)}>
      {score.toFixed(0)}
    </div>
  )
}

/* ── Table columns ─────────────────────────────────────── */

const tableColumns: Column<BombaRow>[] = [
  {
    key: 'posicao',
    label: '#',
    render: (row) => {
      const idx = row._index as number | undefined
      if (idx !== undefined && idx < 3) {
        return <Trophy className={cn('h-4 w-4', idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : 'text-orange-500')} />
      }
      return <span className="text-sm text-gray-500 dark:text-gray-400">{idx !== undefined ? idx + 1 : ''}</span>
    },
  },
  {
    key: 'bicoDescricao',
    label: 'Bico',
    sortable: true,
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{row.bicoDescricao}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{row.combustivelNome}</p>
      </div>
    ),
  },
  {
    key: 'score',
    label: 'Score',
    align: 'center',
    sortable: true,
    render: (row) => <div className="flex justify-center"><ScoreBadge score={row.score} size="sm" /></div>,
  },
  { key: 'receita', label: 'Receita', align: 'right', sortable: true, render: (row) => formatCurrencyShort(row.receita) },
  { key: 'litros', label: 'Litros', align: 'right', sortable: true, render: (row) => formatLitersShort(row.litros) },
  { key: 'totalAbastecimentos', label: 'Abastecimentos', align: 'right', sortable: true, render: (row) => formatNumber(row.totalAbastecimentos) },
  { key: 'ticketMedio', label: 'Ticket Medio', align: 'right', sortable: true, render: (row) => formatCurrency(row.ticketMedio) },
  {
    key: 'margem',
    label: 'Margem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={cn(
        'font-semibold tabular-nums',
        row.margem >= 10 ? 'text-green-600 dark:text-green-400'
          : row.margem >= 0 ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400'
      )}>
        {row.margem.toFixed(1)}%
      </span>
    ),
  },
]

/* ── Component ─────────────────────────────────────────── */

const BombaView = ({ data }: BombaViewProps) => {
  const handleExport = useCallback(() => {
    exportToCsv('combustiveis-bombas', data, csvColumns)
  }, [data])

  const top3 = data.slice(0, 3)
  const tableData = data.map((row, i) => ({ ...row, _index: i }))

  const summary = useMemo(() => {
    const avgScore = data.length > 0 ? data.reduce((s, b) => s + b.score, 0) / data.length : 0
    const bombas = new Set(data.map((b) => b.bicoDescricao.split(' - ')[0]))
    return { avgScore, bombas: bombas.size }
  }, [data])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Visao por Bico/Bomba</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {summary.bombas} bombas / {data.length} bicos — ordenados por score
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 dark:bg-amber-900/30">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Score medio</span>
              <span className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300">{summary.avgScore.toFixed(1)}</span>
            </div>
          )}
          <ExportButton onExport={handleExport} />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-400">Nenhum dado de bico/bomba encontrado no periodo.</p>
        </div>
      ) : (
        <>
          {/* Podium top 3 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {top3.map((bico, index) => {
              const podium = PODIUM[index]
              return (
                <div
                  key={bico.bicoCodigo}
                  className={cn(
                    'relative rounded-xl border-2 bg-white p-5 shadow-sm dark:bg-gray-900',
                    podium.border
                  )}
                >
                  {/* Score badge — top right */}
                  <div className="absolute right-4 top-4">
                    <ScoreBadge score={bico.score} />
                  </div>

                  {/* Header */}
                  <div className="mb-4 pr-14">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{podium.label}</p>
                    <p className="mt-1 truncate text-base font-bold text-gray-900 dark:text-gray-100">
                      {bico.bicoDescricao}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {bico.combustivelNome}
                    </p>
                  </div>

                  {/* Metrics 2x2 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Receita</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrencyShort(bico.receita)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Litros</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatLitersShort(bico.litros)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ticket Medio</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(bico.ticketMedio)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Margem</p>
                      <p className={cn(
                        'text-sm font-bold tabular-nums',
                        bico.margem >= 10 ? 'text-green-600 dark:text-green-400'
                          : bico.margem >= 0 ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {bico.margem.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Ranking table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Ranking Completo</h3>
            </div>
            <DataTable columns={tableColumns} data={tableData} keyExtractor={(row) => row.bicoCodigo} />
          </div>
        </>
      )}
    </div>
  )
}

export default BombaView
