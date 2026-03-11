import { useCallback } from 'react'
import { Trophy, Crown, Medal, Award } from 'lucide-react'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import DataTable, { type Column } from '@/components/tables/DataTable'
import ExportButton from '@/components/tables/ExportButton'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import { cn } from '@/lib/utils'
import type { MergedFrentista } from '@/pages/Operacao/components/ProdutividadeTab'

interface RankingFrentistasProps {
  data: MergedFrentista[]
}

const medalStyles = [
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-400 dark:border-amber-500', icon: Crown },
  { bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', border: 'border-gray-400 dark:border-gray-500', icon: Medal },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-400 dark:border-orange-500', icon: Award },
]

const columns: Column<MergedFrentista>[] = [
  {
    key: 'posicao', label: '#', align: 'center',
    render: (r) => {
      if (r.posicao <= 3) {
        const emojis = ['🥇', '🥈', '🥉']
        return <span className="text-base">{emojis[r.posicao - 1]}</span>
      }
      return <span className="text-sm font-semibold text-gray-400">{r.posicao}º</span>
    },
  },
  {
    key: 'nome', label: 'Frentista', sortable: true,
    render: (r) => (
      <span className={cn('text-sm font-medium', r.posicao <= 3 ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>
        {r.nome}
      </span>
    ),
  },
  { key: 'litrosVendidos', label: 'Litros', align: 'right', sortable: true, render: (r) => formatLiters(r.litrosVendidos) },
  { key: 'atendimentos', label: 'Atendimentos', align: 'right', sortable: true, render: (r) => formatNumber(r.atendimentos) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => formatCurrency(r.faturamento) },
  { key: 'ticketMedio', label: 'Ticket Médio', align: 'right', sortable: true, render: (r) => formatCurrency(r.ticketMedio) },
  {
    key: 'taxaConversao', label: 'Conversão', align: 'right', sortable: true,
    render: (r) => r.taxaConversao > 0
      ? <span className="font-semibold text-indigo-600 dark:text-indigo-400">{r.taxaConversao.toFixed(1)}%</span>
      : <span className="text-gray-400">-</span>,
  },
]

const csvCols: ExportColumn<MergedFrentista>[] = [
  { header: 'Posição', accessor: (r) => r.posicao },
  { header: 'Código', accessor: (r) => r.funcionarioCodigo },
  { header: 'Frentista', accessor: (r) => r.nome },
  { header: 'Litros', accessor: (r) => r.litrosVendidos },
  { header: 'Atendimentos', accessor: (r) => r.atendimentos },
  { header: 'Faturamento', accessor: (r) => r.faturamento },
  { header: 'Ticket Médio', accessor: (r) => r.ticketMedio },
  { header: 'Conversão %', accessor: (r) => r.taxaConversao },
]

const RankingFrentistas = ({ data }: RankingFrentistasProps) => {
  const handleExport = useCallback(() => {
    exportToCsv('ranking-frentistas', data, csvCols)
  }, [data])

  const champion = data[0] ?? null

  return (
    <div className="space-y-5">
      {/* Champion highlight */}
      {champion && (
        <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6 shadow-sm dark:border-amber-700/50 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/20">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-amber-200/20 dark:bg-amber-500/10" />
          <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-yellow-200/30 dark:bg-yellow-500/10" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                  🥇 Campeão
                </span>
                <p className="mt-1.5 text-xl font-bold text-gray-900 dark:text-gray-100">{champion.nome}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-3 sm:justify-end">
              <div className="rounded-xl border border-amber-100 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-amber-800/30 dark:bg-gray-900/50">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Litros</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatLiters(champion.litrosVendidos)}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-amber-800/30 dark:bg-gray-900/50">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Faturamento</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(champion.faturamento)}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-amber-800/30 dark:bg-gray-900/50">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Atendimentos</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatNumber(champion.atendimentos)}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-amber-800/30 dark:bg-gray-900/50">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Ticket Médio</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(champion.ticketMedio)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Podium top 3 */}
      {data.length >= 3 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {data.slice(0, 3).map((f, i) => {
            const style = medalStyles[i]
            const Icon = style.icon
            return (
              <div key={f.funcionarioCodigo} className={cn('rounded-xl border-2 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-gray-900', style.border)}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {i + 1}º Lugar
                  </span>
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', style.bg)}>
                    <Icon className={cn('h-4.5 w-4.5', style.text)} />
                  </div>
                </div>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{f.nome}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Litros</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(f.litrosVendidos)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Faturamento</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(f.faturamento)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Atendimentos</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(f.atendimentos)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ticket Médio</p>
                    <p className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">{formatCurrency(f.ticketMedio)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full ranking table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking Completo</h3>
          <ExportButton onExport={handleExport} />
        </div>
        {data.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">Nenhum dado de frentista no período.</div>
        ) : (
          <DataTable columns={columns} data={data} keyExtractor={(r) => r.funcionarioCodigo} />
        )}
      </div>
    </div>
  )
}

export default RankingFrentistas
