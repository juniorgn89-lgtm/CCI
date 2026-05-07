import { useMemo } from 'react'
import {
  DollarSign, CreditCard, TrendingUp, AlertTriangle,
  ArrowUpRight, ArrowDownRight,
  Receipt, Wallet,
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

    // Comparison chart data
    const comparisonData = [
      { label: 'A Receber', receber: kpis.totalReceber, pagar: 0 },
      { label: 'A Pagar', receber: 0, pagar: kpis.totalPagar },
    ]

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
      comparisonData,
      recentCashFlow,
    }
  }, [kpis, receivablesData, payablesData, cashFlowData])

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
    {
      label: 'Vencidos Receber',
      value: formatCurrency(computed.totalOverdueReceivables),
      subtitle: `${computed.overdueReceivablesCount} título${computed.overdueReceivablesCount !== 1 ? 's' : ''} em atraso`,
      icon: Receipt,
      cardBg: computed.overdueReceivablesCount > 0 ? 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900' : 'bg-gradient-to-br from-gray-50/60 to-white dark:from-gray-950/20 dark:to-gray-900',
      iconColor: computed.overdueReceivablesCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400',
      iconBg: computed.overdueReceivablesCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800',
      tab: 'receber' as TabKey,
    },
    {
      label: 'Vencidos Pagar',
      value: formatCurrency(computed.totalOverduePayables),
      subtitle: `${computed.overduePayablesCount} título${computed.overduePayablesCount !== 1 ? 's' : ''} em atraso`,
      icon: Wallet,
      cardBg: computed.overduePayablesCount > 0 ? 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900' : 'bg-gradient-to-br from-gray-50/60 to-white dark:from-gray-950/20 dark:to-gray-900',
      iconColor: computed.overduePayablesCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400',
      iconBg: computed.overduePayablesCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800',
      tab: 'pagar' as TabKey,
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
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
