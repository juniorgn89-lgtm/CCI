import { useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatDate, formatNumber } from '@/lib/formatters'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import type { DailyRow, GroupRow, RevenueRow, DaySaleProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'
import usePagamentosRaw from '@/pages/Conveniencias/hooks/useDiaPagamentos'
import VendaDetailModal from '@/pages/Conveniencias/components/VendaDetailModal'

interface SalesOverviewProps {
  dailyData: DailyRow[]
  groupTable: GroupRow[]
  revenueData: RevenueRow[]
  /** Produtos vendidos por dia (yyyy-MM-dd → lista) — pro modal do dia. */
  salesByDay: Record<string, DaySaleProduct[]>
  /** Produtos por grupo (grupoCodigo → lista) — pro modal do grupo. */
  productsByGroup: Record<number, DaySaleProduct[]>
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

const formatMonth = (mes: string) => {
  const [year, month] = mes.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[Number(month) - 1]}/${year.slice(2)}`
}

const SalesOverview = ({ dailyData, groupTable, revenueData, salesByDay, productsByGroup }: SalesOverviewProps) => {
  const [subView, setSubView] = useState<SubView>('diario')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<{ codigo: number; nome: string } | null>(null)

  const periodIni = useFilterStore((s) => s.dataInicial)
  const periodFim = useFilterStore((s) => s.dataFinal)

  // Modal do dia → só aquele dia; modal do grupo → período inteiro.
  const dayPag = usePagamentosRaw(selectedDay, selectedDay)
  const groupPag = usePagamentosRaw(selectedGroup ? periodIni : null, selectedGroup ? periodFim : null)

  const dayProducts = selectedDay ? (salesByDay[selectedDay] ?? []) : []
  const groupProducts = selectedGroup ? (productsByGroup[selectedGroup.codigo] ?? []) : []

  const totals = useMemo(() => {
    const faturamento = dailyData.reduce((s, d) => s + d.faturamento, 0)
    const custo = dailyData.reduce((s, d) => s + d.custo, 0)
    const margem = faturamento - custo
    const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0
    const itens = dailyData.reduce((s, d) => s + d.qtdItens, 0)
    return { faturamento, margem, margemPct, itens }
  }, [dailyData])

  const subTabs: { key: SubView; label: string }[] = [
    { key: 'diario', label: 'Dia a Dia' },
    { key: 'grupo', label: 'Por Grupo' },
    { key: 'evolucao', label: 'Evolução' },
  ]

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <TableSummaryStrip
        icon={ShoppingCart}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-100 dark:bg-emerald-900/40"
        title="Vendas do Período"
        subtitle={`${dailyData.length} dias`}
        accentGradient="bg-gradient-to-r from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-gray-900"
        metrics={[
          { label: 'Faturamento', value: formatCurrency(totals.faturamento) },
          { label: 'Margem', value: formatCurrency(totals.margem), color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Margem %', value: `${totals.margemPct.toFixed(1)}%` },
          { label: 'Itens', value: formatNumber(totals.itens) },
        ]}
      />

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
            <span className="text-xs text-gray-400 dark:text-gray-500">Clique num dia pra ver os produtos vendidos</span>
          </div>
          <DataTable columns={dailyCols} data={dailyData} keyExtractor={(r) => r.data} onRowClick={(r) => setSelectedDay(r.data)} />
        </div>
      )}

      {subView === 'grupo' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Vendas por grupo</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Clique num grupo pra ver os produtos</span>
          </div>
          <DataTable columns={groupCols} data={groupTable} keyExtractor={(r) => r.grupoCodigo} onRowClick={(r) => setSelectedGroup({ codigo: r.grupoCodigo, nome: r.nome })} />
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

      {/* Modal do dia — produtos vendidos no dia + pagamento rateado. */}
      <VendaDetailModal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={`Vendas de ${selectedDay ? formatDate(selectedDay) : ''}`}
        products={dayProducts}
        showGroupFilter
        itens={dayPag.itens}
        formas={dayPag.formas}
        pagLoading={dayPag.isLoading}
      />

      {/* Modal do grupo — produtos do grupo no período + pagamento rateado. */}
      <VendaDetailModal
        open={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title={`Grupo: ${selectedGroup?.nome ?? ''}`}
        products={groupProducts}
        itens={groupPag.itens}
        formas={groupPag.formas}
        pagLoading={groupPag.isLoading}
      />
    </div>
  )
}

export default SalesOverview
