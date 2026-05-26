import { useMemo } from 'react'
import {
  DollarSign, CreditCard, TrendingUp, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Hourglass,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatNumber } from '@/lib/formatters'
import type { FinanceKpiData, ReceivableRow, PayableRow, CashFlowRow } from '@/pages/Financeiro/hooks/useFinanceData'

type TabKey = 'indicadores' | 'receber' | 'pagar' | 'fluxo'

interface FinanceiroIndicadoresProps {
  kpis: FinanceKpiData
  receivablesData: ReceivableRow[]
  payablesData: PayableRow[]
  cashFlowData: CashFlowRow[]
  onNavigateTab: (tab: TabKey) => void
}

/* ─── Aging buckets ───
 * Faixas tradicionais de cobrança: < 30d ainda recuperável, > 90d normalmente
 * tratado como provisão. Usado pra direcionar estratégia (lembrete vs. negativação
 * vs. write-off) — diferença qualitativa enorme em relação a um único total "vencido".
 */
interface AgingBucket {
  label: string
  count: number
  total: number
  /** Tema de cor: âmbar (recente) → vermelho-escuro (antigo). */
  tone: 'amber' | 'orange' | 'red' | 'darkRed'
}

const buildAgingBuckets = (
  rows: Array<{ diasAtraso: number; valor: number }>
): AgingBucket[] => {
  const buckets: AgingBucket[] = [
    { label: '< 30 dias', count: 0, total: 0, tone: 'amber' },
    { label: '30-60 dias', count: 0, total: 0, tone: 'orange' },
    { label: '60-90 dias', count: 0, total: 0, tone: 'red' },
    { label: '> 90 dias', count: 0, total: 0, tone: 'darkRed' },
  ]
  for (const r of rows) {
    if (r.diasAtraso <= 0) continue
    const idx = r.diasAtraso < 30 ? 0 : r.diasAtraso < 60 ? 1 : r.diasAtraso < 90 ? 2 : 3
    buckets[idx].count += 1
    buckets[idx].total += r.valor
  }
  return buckets
}

const TONE_STYLES: Record<AgingBucket['tone'], { card: string; label: string; value: string; count: string }> = {
  amber: {
    card: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-900/10',
    label: 'text-amber-700 dark:text-amber-400',
    value: 'text-amber-800 dark:text-amber-300',
    count: 'text-amber-600/80 dark:text-amber-400/70',
  },
  orange: {
    card: 'border-orange-200 bg-orange-50/70 dark:border-orange-900/40 dark:bg-orange-900/10',
    label: 'text-orange-700 dark:text-orange-400',
    value: 'text-orange-800 dark:text-orange-300',
    count: 'text-orange-600/80 dark:text-orange-400/70',
  },
  red: {
    card: 'border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-900/10',
    label: 'text-red-700 dark:text-red-400',
    value: 'text-red-800 dark:text-red-300',
    count: 'text-red-600/80 dark:text-red-400/70',
  },
  darkRed: {
    card: 'border-red-300 bg-red-100/70 dark:border-red-800/60 dark:bg-red-900/25',
    label: 'text-red-800 dark:text-red-300',
    value: 'text-red-900 dark:text-red-200',
    count: 'text-red-700/80 dark:text-red-300/70',
  },
}

const AgingColumn = ({
  title,
  buckets,
  total,
  onClick,
}: {
  title: string
  buckets: AgingBucket[]
  total: number
  onClick: () => void
}) => {
  const totalCount = buckets.reduce((acc, b) => acc + b.count, 0)
  const isEmpty = totalCount === 0

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {title}
        </span>
        <button
          onClick={onClick}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Ver títulos →
        </button>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center dark:border-gray-700 dark:bg-gray-800/40">
          <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum título vencido.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {buckets.map((b) => {
              const t = TONE_STYLES[b.tone]
              return (
                <div
                  key={b.label}
                  className={cn('rounded-lg border px-3 py-2.5', t.card)}
                >
                  <p className={cn('text-[10px] font-semibold uppercase tracking-wide', t.label)}>
                    {b.label}
                  </p>
                  <p className={cn('mt-1 text-sm font-bold tabular-nums', t.value)}>
                    {formatCurrencyShort(b.total)}
                  </p>
                  <p className={cn('mt-0.5 text-[11px] tabular-nums', t.count)}>
                    {b.count} {b.count === 1 ? 'título' : 'títulos'}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Total vencido — {totalCount} {totalCount === 1 ? 'título' : 'títulos'}
            </span>
            <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {formatCurrency(total)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

const FinanceiroIndicadores = ({ kpis, receivablesData, payablesData, cashFlowData, onNavigateTab }: FinanceiroIndicadoresProps) => {
  const computed = useMemo(() => {
    // Cash flow totals
    const totalEntradas = cashFlowData.reduce((acc, r) => acc + r.entradas, 0)
    const totalSaidas = cashFlowData.reduce((acc, r) => acc + r.saidas, 0)
    const saldoFluxo = totalEntradas - totalSaidas
    const lastCashFlow = cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1] : null

    // Overdue receivables breakdown
    const overdueReceivables = receivablesData.filter((r) => r.statusTag === 'vencido')
    const pendingReceivables = receivablesData.filter((r) => r.statusTag === 'a-vencer')
    const totalOverdueReceivables = overdueReceivables.reduce((acc, r) => acc + r.valor, 0)
    const totalPendingReceivables = pendingReceivables.reduce((acc, r) => acc + r.valor, 0)

    // Overdue payables breakdown
    const overduePayables = payablesData.filter((p) => p.statusTag === 'vencido')
    const pendingPayables = payablesData.filter((p) => p.statusTag === 'a-vencer')
    const totalOverduePayables = overduePayables.reduce((acc, p) => acc + p.saldoRestante, 0)
    const totalPendingPayables = pendingPayables.reduce((acc, p) => acc + p.saldoRestante, 0)

    // Aging — vencidos distribuídos por faixa de atraso (substitui os 2 cards "Vencidos *"
    // que mostravam só o total, sem indicar se é dor crônica ou recente).
    const agingReceber = buildAgingBuckets(
      overdueReceivables.map((r) => ({ diasAtraso: r.diasAtraso, valor: r.valor }))
    )
    const agingPagar = buildAgingBuckets(
      overduePayables.map((p) => ({ diasAtraso: p.diasAtraso, valor: p.saldoRestante }))
    )

    // Cash flow chart — last 10 days for quick view
    const recentCashFlow = cashFlowData.slice(-10).map((r) => ({
      ...r,
      data: r.data.substring(5), // MM-DD
    }))

    return {
      totalEntradas,
      totalSaidas,
      saldoFluxo,
      lastCashFlow,
      totalOverdueReceivables,
      totalPendingReceivables,
      overdueReceivablesCount: overdueReceivables.length,
      pendingReceivablesCount: pendingReceivables.length,
      totalOverduePayables,
      totalPendingPayables,
      overduePayablesCount: overduePayables.length,
      pendingPayablesCount: pendingPayables.length,
      agingReceber,
      agingPagar,
      recentCashFlow,
    }
  }, [receivablesData, payablesData, cashFlowData])

  const kpiCards = [
    {
      label: 'Total a Receber',
      value: formatCurrency(kpis.totalReceber),
      subtitle: `${formatNumber(kpis.countReceber)} títulos pendentes${kpis.countVencidosReceber > 0 ? ` · ${kpis.countVencidosReceber} vencidos` : ''}`,
      icon: DollarSign,
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      tab: 'receber' as TabKey,
    },
    {
      label: 'Total a Pagar',
      value: formatCurrency(kpis.totalPagar),
      subtitle: `${formatNumber(kpis.countPagar)} títulos pendentes${kpis.countVencidosPagar > 0 ? ` · ${kpis.countVencidosPagar} vencidos` : ''}`,
      icon: CreditCard,
      cardBg: 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900',
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      tab: 'pagar' as TabKey,
    },
    {
      label: 'Saldo Líquido',
      value: formatCurrency(kpis.saldoLiquido),
      subtitle: kpis.saldoLiquido >= 0 ? 'Posição favorável' : 'Posição desfavorável',
      icon: TrendingUp,
      cardBg: kpis.saldoLiquido >= 0 ? 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900' : 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconColor: kpis.saldoLiquido >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400',
      iconBg: kpis.saldoLiquido >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
      tab: 'fluxo' as TabKey,
    },
    {
      label: 'Inadimplência',
      value: formatCurrency(kpis.inadimplencia),
      subtitle: kpis.inadimplenciaPercent > 0
        ? `${kpis.inadimplenciaPercent.toFixed(1)}% do total a receber`
        : 'Nenhum título vencido',
      icon: AlertTriangle,
      cardBg: kpis.inadimplencia > 0 ? 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900' : 'bg-gradient-to-br from-gray-50/60 to-white dark:from-gray-950/20 dark:to-gray-900',
      iconColor: kpis.inadimplencia > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400',
      iconBg: kpis.inadimplencia > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-800',
      tab: 'receber' as TabKey,
    },
    {
      label: 'Entradas',
      value: formatCurrency(computed.totalEntradas),
      subtitle: `${cashFlowData.length} dia${cashFlowData.length !== 1 ? 's' : ''} com movimentação`,
      icon: ArrowUpRight,
      cardBg: 'bg-gradient-to-br from-green-50/60 to-white dark:from-green-950/20 dark:to-gray-900',
      iconColor: 'text-green-600 dark:text-green-400',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      tab: 'fluxo' as TabKey,
    },
    {
      label: 'Saídas',
      value: formatCurrency(computed.totalSaidas),
      subtitle: computed.saldoFluxo >= 0 ? 'Cobertas pelas entradas' : 'Acima das entradas',
      icon: ArrowDownRight,
      cardBg: 'bg-gradient-to-br from-orange-50/60 to-white dark:from-orange-950/20 dark:to-gray-900',
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      tab: 'fluxo' as TabKey,
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs (6 cards — Vencidos Receber/Pagar foram movidos pra seção Aging abaixo) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => onNavigateTab(card.tab)}
              className={cn('rounded-lg border border-gray-200/60 px-3 py-2.5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700/60', card.cardBg)}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', card.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', card.iconColor)} />
                </div>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{card.subtitle}</p>
            </button>
          )
        })}
      </div>

      {/* Aging de Inadimplência — substitui os cards "Vencidos *" com detalhamento por faixa */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Hourglass className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Aging de Inadimplência
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            — vencidos por faixa de atraso
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AgingColumn
            title="A Receber"
            buckets={computed.agingReceber}
            total={computed.totalOverdueReceivables}
            onClick={() => onNavigateTab('receber')}
          />
          <AgingColumn
            title="A Pagar"
            buckets={computed.agingPagar}
            total={computed.totalOverduePayables}
            onClick={() => onNavigateTab('pagar')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Receber vs Pagar */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <TrendingUp className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Receber vs Pagar
          </h3>
          <div className="space-y-4">
            {/* Receber bar */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">A Receber</span>
                <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(kpis.totalReceber)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-3 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, kpis.totalReceber > 0 && kpis.totalPagar > 0 ? (kpis.totalReceber / Math.max(kpis.totalReceber, kpis.totalPagar)) * 100 : kpis.totalReceber > 0 ? 100 : 0)}%` }}
                />
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
                <span>{computed.pendingReceivablesCount} a vencer ({formatCurrencyShort(computed.totalPendingReceivables)})</span>
                {computed.overdueReceivablesCount > 0 && (
                  <span className="text-red-500">{computed.overdueReceivablesCount} vencidos ({formatCurrencyShort(computed.totalOverdueReceivables)})</span>
                )}
              </div>
            </div>

            {/* Pagar bar */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">A Pagar</span>
                <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(kpis.totalPagar)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-3 rounded-full bg-red-500 transition-all"
                  style={{ width: `${Math.min(100, kpis.totalReceber > 0 && kpis.totalPagar > 0 ? (kpis.totalPagar / Math.max(kpis.totalReceber, kpis.totalPagar)) * 100 : kpis.totalPagar > 0 ? 100 : 0)}%` }}
                />
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
                <span>{computed.pendingPayablesCount} a vencer ({formatCurrencyShort(computed.totalPendingPayables)})</span>
                {computed.overduePayablesCount > 0 && (
                  <span className="text-red-500">{computed.overduePayablesCount} vencidos ({formatCurrencyShort(computed.totalOverduePayables)})</span>
                )}
              </div>
            </div>

            {/* Balance */}
            <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Saldo Líquido</span>
                <span className={cn(
                  'text-sm font-bold tabular-nums',
                  kpis.saldoLiquido >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {formatCurrency(kpis.saldoLiquido)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Fluxo de Caixa Resumo */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <DollarSign className="mr-1.5 inline h-4 w-4 text-green-500" />
              Fluxo de Caixa
            </h3>
            <button onClick={() => onNavigateTab('fluxo')} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Ver completo
            </button>
          </div>
          {computed.recentCashFlow.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Sem dados de movimentação.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={computed.recentCashFlow} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrencyShort(v)} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={((v: number, name: string) => [formatCurrency(v), name === 'entradas' ? 'Entradas' : 'Saídas']) as never}
                  />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {computed.lastCashFlow && (
                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Saldo Acumulado</span>
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      computed.lastCashFlow.saldoAcumulado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {formatCurrency(computed.lastCashFlow.saldoAcumulado)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FinanceiroIndicadores
