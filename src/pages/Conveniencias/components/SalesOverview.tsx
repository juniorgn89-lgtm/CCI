import { useCallback, useState } from 'react'
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
  AreaChart,
  Area,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatDate, formatNumber } from '@/lib/formatters'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import { cn } from '@/lib/utils'
import type { DailyRow, GroupRow, RevenueRow } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface SalesOverviewProps {
  dailyData: DailyRow[]
  groupTable: GroupRow[]
  revenueData: RevenueRow[]
}

type SubView = 'diario' | 'grupo' | 'evolucao'

const dailyCols: Column<DailyRow>[] = [
  { key: 'data', label: 'Data', sortable: true, render: (r) => formatDate(r.data) },
  { key: 'qtdItens', label: 'Itens', align: 'right', sortable: true, render: (r) => formatNumber(r.qtdItens) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => formatCurrency(r.faturamento) },
  { key: 'custo', label: 'Custo', align: 'right', sortable: true, render: (r) => formatCurrency(r.custo) },
  { key: 'margemRs', label: 'Margem R$', align: 'right', sortable: true, render: (r) => formatCurrency(r.margemRs) },
  {
    key: 'margemPct', label: 'Margem %', align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.margemPct} min={-10} max={40} formatted={`${r.margemPct.toFixed(1)}%`} />,
  },
]

const groupCols: Column<GroupRow>[] = [
  { key: 'nome', label: 'Grupo', sortable: true },
  { key: 'quantidade', label: 'Qtd Vendida', align: 'right', sortable: true, render: (r) => formatNumber(r.quantidade) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => formatCurrency(r.faturamento) },
  { key: 'margemTotal', label: 'Margem R$', align: 'right', sortable: true, render: (r) => formatCurrency(r.margemTotal) },
  {
    key: 'margemPct', label: 'Margem %', align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.margemPct} min={-10} max={40} formatted={`${r.margemPct.toFixed(1)}%`} />,
  },
]

const dailyCsvCols: ExportColumn<DailyRow>[] = [
  { header: 'Data', accessor: (r) => r.data },
  { header: 'Itens', accessor: (r) => r.qtdItens },
  { header: 'Faturamento', accessor: (r) => r.faturamento },
  { header: 'Custo', accessor: (r) => r.custo },
  { header: 'Margem R$', accessor: (r) => r.margemRs },
  { header: 'Margem %', accessor: (r) => r.margemPct },
]

const fmtDay = (d: string) => {
  const parts = d.split('-')
  return `${parts[2]}/${parts[1]}`
}

const formatMonth = (mes: string) => {
  const [year, month] = mes.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[Number(month) - 1]}/${year.slice(2)}`
}

const SalesOverview = ({ dailyData, groupTable, revenueData }: SalesOverviewProps) => {
  const [subView, setSubView] = useState<SubView>('diario')

  const handleExport = useCallback(() => {
    exportToCsv('conveniencia-vendas-diario', dailyData, dailyCsvCols)
  }, [dailyData])

  const subTabs: { key: SubView; label: string }[] = [
    { key: 'diario', label: 'Dia a Dia' },
    { key: 'grupo', label: 'Por Grupo' },
    { key: 'evolucao', label: 'Evolução' },
  ]

  return (
    <div className="space-y-4">
      {/* Daily sales chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Vendas Diárias</h3>
        {dailyData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">Sem dados no período.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis dataKey="data" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number, name: string) => [formatCurrencyTooltip(v), name]) as never}
                labelFormatter={fmtDay as never}
              />
              <Legend />
              <Bar dataKey="faturamento" name="Faturamento" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="margemRs" name="Margem" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubView(tab.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
              subView === tab.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tables / chart */}
      {subView === 'diario' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Resumo diário</span>
            <ExportButton onExport={handleExport} />
          </div>
          <DataTable columns={dailyCols} data={dailyData} keyExtractor={(r) => r.data} />
        </div>
      )}

      {subView === 'grupo' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Vendas por grupo</span>
          </div>
          <DataTable columns={groupCols} data={groupTable} keyExtractor={(r) => r.grupoCodigo} />
        </div>
      )}

      {subView === 'evolucao' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Evolução de Faturamento</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tickFormatter={formatMonth} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={((v: number, name: string) => [formatCurrencyTooltip(v), name]) as never}
                labelFormatter={formatMonth as never}
              />
              <Legend />
              <Area type="monotone" dataKey="faturamento" name="Faturamento" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.15} />
              <Area type="monotone" dataKey="margem" name="Margem" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default SalesOverview
