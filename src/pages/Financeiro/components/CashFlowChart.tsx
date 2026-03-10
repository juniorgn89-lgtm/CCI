import { useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import ExportButton from '@/components/tables/ExportButton'
import { formatDate, formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import { COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type { CashFlowRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface CashFlowChartProps {
  data: CashFlowRow[]
}

type ChartView = 'fluxo' | 'acumulado'

const csvExportColumns: ExportColumn<CashFlowRow>[] = [
  { header: 'Data', accessor: (r) => r.data },
  { header: 'Entradas', accessor: (r) => r.entradas },
  { header: 'Saídas', accessor: (r) => r.saidas },
  { header: 'Saldo Diário', accessor: (r) => r.saldo },
  { header: 'Saldo Acumulado', accessor: (r) => r.saldoAcumulado },
]

const CashFlowChart = ({ data }: CashFlowChartProps) => {
  const [view, setView] = useState<ChartView>('fluxo')

  const handleExport = useCallback(() => {
    exportToCsv('financeiro-fluxo-caixa', data, csvExportColumns)
  }, [data])

  // Summary computations
  const totalEntradas = data.reduce((acc, d) => acc + d.entradas, 0)
  const totalSaidas = data.reduce((acc, d) => acc + d.saidas, 0)
  const saldoPeriodo = totalEntradas - totalSaidas

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum movimento encontrado para o período selecionado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">Total Entradas</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-green-700 dark:text-green-300">
            {formatCurrencyShort(totalEntradas)}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">Total Saídas</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-red-700 dark:text-red-300">
            {formatCurrencyShort(totalSaidas)}
          </p>
        </div>
        <div className={cn(
          'rounded-lg border px-4 py-3',
          saldoPeriodo >= 0
            ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
            : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
        )}>
          <p className={cn(
            'text-xs font-medium',
            saldoPeriodo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
          )}>Saldo do Período</p>
          <p className={cn(
            'mt-1 text-lg font-bold tabular-nums',
            saldoPeriodo >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'
          )}>
            {formatCurrencyShort(saldoPeriodo)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fluxo de Caixa</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              {([
                { key: 'fluxo' as const, label: 'Diário' },
                { key: 'acumulado' as const, label: 'Acumulado' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setView(opt.key)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    view === opt.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <ExportButton onExport={handleExport} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          {view === 'fluxo' ? (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="data"
                tickFormatter={(v: string) => formatDate(v)}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={((value: number, name: string) => [
                  formatCurrencyTooltip(value),
                  name,
                ]) as never}
                labelFormatter={((label: string) => formatDate(label)) as never}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar
                dataKey="entradas"
                name="Entradas"
                fill={COLORS.positive}
                fillOpacity={0.8}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="saidas"
                name="Saídas"
                fill={COLORS.negative}
                fillOpacity={0.8}
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                name="Saldo Diário"
                stroke={COLORS.accent}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="data"
                tickFormatter={(v: string) => formatDate(v)}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={((value: number, name: string) => [
                  formatCurrencyTooltip(value),
                  name,
                ]) as never}
                labelFormatter={((label: string) => formatDate(label)) as never}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar
                dataKey="saldo"
                name="Saldo Diário"
                fill={COLORS.accent}
                fillOpacity={0.3}
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="saldoAcumulado"
                name="Saldo Acumulado"
                stroke={COLORS.primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: COLORS.primary }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default CashFlowChart
