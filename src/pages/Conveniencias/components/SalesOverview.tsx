import { useMemo, useState } from 'react'
import { ShoppingCart, Search, Info } from 'lucide-react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { DailyRow, GroupRow, RevenueRow, DaySaleProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'
import useDiaPagamentos, { computeProratedPagamentos } from '@/pages/Conveniencias/hooks/useDiaPagamentos'

const PGTO_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

interface SalesOverviewProps {
  dailyData: DailyRow[]
  groupTable: GroupRow[]
  revenueData: RevenueRow[]
  /** Produtos vendidos por dia (yyyy-MM-dd → lista) — pro modal de detalhe. */
  salesByDay: Record<string, DaySaleProduct[]>
}

const dayProductCols: Column<DaySaleProduct>[] = [
  { key: 'nome', label: 'Produto', sortable: true },
  { key: 'grupo', label: 'Grupo', sortable: true },
  { key: 'quantidade', label: 'Qtd', align: 'right', sortable: true, render: (r) => formatNumber(r.quantidade) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => formatCurrency(r.faturamento) },
  { key: 'margemRs', label: 'Margem R$', align: 'right', sortable: true, render: (r) => formatCurrency(r.margemRs) },
  {
    key: 'margemPct', label: 'Margem %', align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.margemPct} min={-10} max={40} formatted={`${r.margemPct.toFixed(1)}%`} />,
  },
]

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

const SalesOverview = ({ dailyData, groupTable, revenueData, salesByDay }: SalesOverviewProps) => {
  const [subView, setSubView] = useState<SubView>('diario')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [daySearch, setDaySearch] = useState('')
  const [dayGrupo, setDayGrupo] = useState('')

  const openDay = (data: string) => {
    setSelectedDay(data)
    setDaySearch('')
    setDayGrupo('')
  }

  const dayProducts = selectedDay ? (salesByDay[selectedDay] ?? []) : []

  const dayGrupos = useMemo(
    () => [...new Set(dayProducts.map((p) => p.grupo))].sort(),
    [dayProducts],
  )
  const dayFiltered = useMemo(() => {
    let result = dayProducts
    if (daySearch) {
      const q = daySearch.toLowerCase()
      result = result.filter((p) => p.nome.toLowerCase().includes(q) || p.grupo.toLowerCase().includes(q))
    }
    if (dayGrupo) result = result.filter((p) => p.grupo === dayGrupo)
    return result
  }, [dayProducts, daySearch, dayGrupo])

  // Totais do cabeçalho refletem o que está filtrado (não o total geral).
  const dayTotals = useMemo(() => {
    const faturamento = dayFiltered.reduce((s, p) => s + p.faturamento, 0)
    const custo = dayFiltered.reduce((s, p) => s + p.custo, 0)
    const margem = faturamento - custo
    return {
      faturamento,
      margem,
      margemPct: faturamento > 0 ? (margem / faturamento) * 100 : 0,
      itens: dayFiltered.length,
    }
  }, [dayFiltered])

  const pagRaw = useDiaPagamentos(selectedDay)
  // Rateio do pagamento pelos produtos exibidos (acompanha busca + grupo).
  const pagamentos = useMemo(() => {
    const displayedCodes = new Set(dayFiltered.map((p) => p.produtoCodigo))
    return computeProratedPagamentos(pagRaw.itens, pagRaw.formas, displayedCodes)
  }, [pagRaw.itens, pagRaw.formas, dayFiltered])

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
          <DataTable columns={dailyCols} data={dailyData} keyExtractor={(r) => r.data} onRowClick={(r) => openDay(r.data)} />
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

      {/* Modal de detalhe do dia — produtos vendidos (dados já em memória). */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => { if (!open) setSelectedDay(null) }}>
        <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Vendas de {selectedDay ? formatDate(selectedDay) : ''}</DialogTitle>
            <DialogDescription>
              {dayTotals.itens} produto{dayTotals.itens === 1 ? '' : 's'} · {formatCurrency(dayTotals.faturamento)} · margem {dayTotals.margemPct.toFixed(1)}%
            </DialogDescription>
          </DialogHeader>

          {dayProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sem produtos vendidos nesse dia.</p>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar produto ou grupo..."
                    value={daySearch}
                    onChange={(e) => setDaySearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                </div>
                <select
                  value={dayGrupo}
                  onChange={(e) => setDayGrupo(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="">Todos os grupos</option>
                  {dayGrupos.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {(daySearch || dayGrupo) && (
                  <button
                    onClick={() => { setDaySearch(''); setDayGrupo('') }}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Só a tabela de produtos rola; o resumo de pagamentos fica fixo abaixo. */}
              <div className="-mx-6 mt-1 flex-1 overflow-auto px-6">
                <DataTable columns={dayProductCols} data={dayFiltered} keyExtractor={(r) => r.produtoCodigo} />
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Exibindo {dayFiltered.length} de {dayProducts.length} produtos
                </p>
              </div>

              {/* Formas de pagamento do dia — fixo (sempre visível) — posto inteiro (loja + combustível). */}
              <div className="mt-3 shrink-0 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Formas de pagamento do dia</h4>
                  <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500" title="O pagamento é por venda; rateamos pela proporção do valor dos produtos exibidos.">
                    <Info className="h-3 w-3" /> estimado · rateio por valor
                  </span>
                </div>
                {pagRaw.isLoading ? (
                  <p className="py-2 text-xs text-gray-400">Carregando…</p>
                ) : pagamentos.breakdown.length === 0 ? (
                  <p className="py-2 text-xs text-gray-400">Sem pagamentos registrados nesse dia.</p>
                ) : (
                  <div className="space-y-2">
                    {pagamentos.breakdown.map((p, i) => {
                      const pct = pagamentos.total > 0 ? (p.valor / pagamentos.total) * 100 : 0
                      return (
                        <div key={p.tipo} className="flex items-center gap-3">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: PGTO_COLORS[i % PGTO_COLORS.length] }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p.nome}</span>
                              <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct.toFixed(1)}%</span>
                            </div>
                            <p className="text-[10px] tabular-nums text-gray-400">
                              {formatCurrency(p.valor)} · {formatNumber(p.quantidade)} transações
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Total</span>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(pagamentos.total)}</p>
                        <p className="text-[10px] tabular-nums text-gray-400">
                          {formatNumber(pagamentos.totalTransacoes)} {pagamentos.totalTransacoes === 1 ? 'transação' : 'transações'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SalesOverview
