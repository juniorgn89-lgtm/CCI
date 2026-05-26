import { useMemo, useState } from 'react'
import {
  ArrowUpRight, ArrowDownRight, Hourglass, CalendarClock,
  Receipt, CreditCard, TrendingUp, Scale, AlertTriangle,
} from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatDate } from '@/lib/formatters'
import type { FinanceKpiData, ReceivableRow, PayableRow, CashFlowRow } from '@/pages/Financeiro/hooks/useFinanceData'

type TabKey = 'visao' | 'receber' | 'pagar' | 'fluxo'

interface FinanceiroIndicadoresProps {
  kpis: FinanceKpiData
  receivablesData: ReceivableRow[]
  payablesData: PayableRow[]
  cashFlowData: CashFlowRow[]
  onNavigateTab: (tab: TabKey) => void
}

/* ─── Aging buckets ───
 * Faixas tradicionais de cobrança: < 30d ainda recuperável, > 90d normalmente
 * tratado como provisão.
 */
interface AgingBucket {
  label: string
  count: number
  total: number
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

/* ─── Próximos vencimentos ───
 * Top 5 a vencer mais próximos — direciona ação imediata (cobrar X
 * ou separar caixa pra pagar Y).
 */
const ProximosVencimentos = <T extends { codigo: number; nome: string; valor: number; data: string }>({
  title,
  rows,
  emptyMessage,
  onClick,
  accentColor,
  icon: Icon,
  nowTs,
}: {
  title: string
  rows: T[]
  emptyMessage: string
  onClick: () => void
  accentColor: 'emerald' | 'red'
  icon: typeof Receipt
  nowTs: number
}) => {
  const max = Math.max(...rows.map((r) => r.valor), 0)
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', accentColor === 'emerald' ? 'text-emerald-500' : 'text-red-500')} />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Ver todos
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-gray-400">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => {
            const barWidth = max > 0 ? (r.valor / max) * 100 : 0
            const diasAteVencer = Math.ceil((new Date(`${r.data}T00:00:00`).getTime() - nowTs) / 86_400_000)
            const isProximo = diasAteVencer <= 7
            return (
              <li key={r.codigo} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100" title={r.nome}>
                    {r.nome}
                  </span>
                  <span className={cn(
                    'shrink-0 font-semibold tabular-nums',
                    accentColor === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
                  )}>
                    {formatCurrency(r.valor)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        accentColor === 'emerald' ? 'bg-emerald-500/70' : 'bg-red-500/70',
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className={cn(
                    'shrink-0 text-[10px] tabular-nums',
                    isProximo ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-gray-400',
                  )}>
                    {formatDate(r.data)} · {diasAteVencer < 0 ? `${Math.abs(diasAteVencer)}d atrás` : diasAteVencer === 0 ? 'hoje' : `${diasAteVencer}d`}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const FinanceiroIndicadores = ({ kpis, receivablesData, payablesData, cashFlowData, onNavigateTab }: FinanceiroIndicadoresProps) => {
  // "Agora" capturado uma vez (Date.now em render é impuro)
  const [nowTs] = useState(() => Date.now())
  const computed = useMemo(() => {
    // Cash flow totals
    const totalEntradas = cashFlowData.reduce((acc, r) => acc + r.entradas, 0)
    const totalSaidas = cashFlowData.reduce((acc, r) => acc + r.saidas, 0)
    const saldoFluxo = totalEntradas - totalSaidas

    // Overdue rows pra aging
    const overdueReceivables = receivablesData.filter((r) => r.statusTag === 'vencido')
    const overduePayables = payablesData.filter((p) => p.statusTag === 'vencido')
    const totalOverdueReceivables = overdueReceivables.reduce((acc, r) => acc + r.valor, 0)
    const totalOverduePayables = overduePayables.reduce((acc, p) => acc + p.saldoRestante, 0)

    const agingReceber = buildAgingBuckets(
      overdueReceivables.map((r) => ({ diasAtraso: r.diasAtraso, valor: r.valor }))
    )
    const agingPagar = buildAgingBuckets(
      overduePayables.map((p) => ({ diasAtraso: p.diasAtraso, valor: p.saldoRestante }))
    )

    // Top 5 próximos a vencer — ordenados pela proximidade do vencimento
    const proximosReceber = receivablesData
      .filter((r) => r.statusTag === 'a-vencer')
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 5)
      .map((r) => ({ codigo: r.codigo, nome: r.nomeCliente, valor: r.valor, data: r.dataVencimento }))

    const proximosPagar = payablesData
      .filter((p) => p.statusTag === 'a-vencer')
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 5)
      .map((p) => ({ codigo: p.codigo, nome: p.nomeFornecedor, valor: p.saldoRestante, data: p.vencimento }))

    // Cash flow chart — todos os dias do período, com saldo acumulado.
    // Reduce em vez de mutar `let acum` (regra de pureza).
    const chartData = cashFlowData.reduce<{ rows: Array<{ data: string; dataLabel: string; entradas: number; saidas: number; saldoAcumulado: number }>; acum: number }>(
      (acc, r) => {
        const acum = acc.acum + r.entradas - r.saidas
        acc.rows.push({
          data: r.data,
          dataLabel: r.data.substring(8) + '/' + r.data.substring(5, 7),
          entradas: r.entradas,
          saidas: -r.saidas,  // negativo pra empilhar visualmente abaixo do eixo
          saldoAcumulado: acum,
        })
        return { rows: acc.rows, acum }
      },
      { rows: [], acum: 0 },
    ).rows

    return {
      totalEntradas,
      totalSaidas,
      saldoFluxo,
      totalOverdueReceivables,
      totalOverduePayables,
      agingReceber,
      agingPagar,
      proximosReceber,
      proximosPagar,
      chartData,
    }
  }, [receivablesData, payablesData, cashFlowData])

  return (
    <div className="space-y-4">
      {/* KPIs principais — totais financeiros do período (movidos do topo da página) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigateTab('receber')}
          className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">A Receber</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(kpis.totalReceber)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {kpis.countReceber} {kpis.countReceber === 1 ? 'título' : 'títulos'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('pagar')}
          className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-orange-950/20 dark:to-gray-900"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">A Pagar</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(kpis.totalPagar)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {kpis.countPagar} {kpis.countPagar === 1 ? 'conta' : 'contas'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('fluxo')}
          className={cn(
            'rounded-xl border border-gray-200 bg-gradient-to-br p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700',
            kpis.saldoLiquido >= 0
              ? 'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900'
              : 'from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900',
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Saldo Líquido</p>
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              kpis.saldoLiquido >= 0
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : 'bg-red-100 dark:bg-red-900/30',
            )}>
              <Scale className={cn(
                'h-5 w-5',
                kpis.saldoLiquido >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(kpis.saldoLiquido)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            A Receber − A Pagar
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('receber')}
          className="rounded-xl border border-gray-200 bg-gradient-to-br from-red-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-red-950/20 dark:to-gray-900"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inadimplência</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(kpis.totalVencidosReceber)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {kpis.countVencidosReceber} {kpis.countVencidosReceber === 1 ? 'vencido' : 'vencidos'} · {kpis.inadimplenciaPercent.toFixed(1).replace('.', ',')}%
          </p>
        </button>
      </div>

      {/* Cards de cash flow — entradas/saídas/saldo do período */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50/60 to-white p-4 shadow-sm dark:border-gray-700 dark:from-green-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Entradas</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(computed.totalEntradas)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {cashFlowData.length} dia{cashFlowData.length === 1 ? '' : 's'} com movimentação
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50/60 to-white p-4 shadow-sm dark:border-gray-700 dark:from-orange-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Saídas</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <ArrowDownRight className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(computed.totalSaidas)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {computed.saldoFluxo >= 0 ? 'Cobertas pelas entradas' : 'Acima das entradas'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('fluxo')}
          className={cn(
            'rounded-xl border p-4 text-left shadow-sm transition-all hover:shadow-md',
            computed.saldoFluxo >= 0
              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-gray-900'
              : 'border-red-200 bg-gradient-to-br from-red-50/60 to-white dark:border-red-900/50 dark:from-red-950/20 dark:to-gray-900',
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Saldo do Fluxo</p>
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              computed.saldoFluxo >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30',
            )}>
              <TrendingUp className={cn(
                'h-4 w-4',
                computed.saldoFluxo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )} />
            </div>
          </div>
          <p className={cn(
            'mt-2 text-xl font-bold tabular-nums',
            computed.saldoFluxo >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
          )}>
            {computed.saldoFluxo >= 0 ? '+' : ''}{formatCurrency(computed.saldoFluxo)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            entradas − saídas no período
          </p>
        </button>
      </div>

      {/* Aging de Inadimplência */}
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

      {/* Próximos Vencimentos — top 5 cada lado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProximosVencimentos
          title="Próximos a Receber"
          rows={computed.proximosReceber}
          emptyMessage="Sem títulos a vencer."
          onClick={() => onNavigateTab('receber')}
          accentColor="emerald"
          icon={Receipt}
          nowTs={nowTs}
        />
        <ProximosVencimentos
          title="Próximos a Pagar"
          rows={computed.proximosPagar}
          emptyMessage="Sem contas a vencer."
          onClick={() => onNavigateTab('pagar')}
          accentColor="red"
          icon={CreditCard}
          nowTs={nowTs}
        />
      </div>

      {/* Fluxo de Caixa — chart unificado com entradas/saídas + saldo acumulado */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fluxo de Caixa</h3>
            <span className="text-[11px] text-gray-400">
              entradas, saídas e saldo acumulado do período
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('fluxo')}
            className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Ver completo
          </button>
        </div>
        <div className="p-4">
          {computed.chartData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-gray-400">Sem movimentação no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={computed.chartData} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="entradas-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="saidas-gradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis
                  dataKey="dataLabel"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCurrencyShort(v)}
                  width={62}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#3b82f6' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCurrencyShort(v)}
                  width={62}
                />
                <ReferenceLine yAxisId="left" y={0} stroke="#9ca3af" strokeWidth={1} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                  formatter={((v: number, name: string) => {
                    if (name === 'Entradas') return [formatCurrency(v), 'Entradas']
                    if (name === 'Saídas') return [formatCurrency(Math.abs(v)), 'Saídas']
                    if (name === 'Saldo acumulado') return [formatCurrency(v), 'Saldo acumulado']
                    return [formatCurrency(v), name]
                  }) as never}
                  labelFormatter={((label: string) => `Dia ${label}`) as never}
                  // Força ordem lógica: Entradas → Saídas → Saldo acumulado.
                  // Recharts default ordena por render order (Bar vs Line), que jogava
                  // o saldo no meio.
                  itemSorter={((item: { name: string }) => {
                    if (item.name === 'Entradas') return 0
                    if (item.name === 'Saídas') return 1
                    return 2
                  }) as never}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                <Bar yAxisId="left" dataKey="entradas" name="Entradas" fill="url(#entradas-gradient)" radius={[4, 4, 0, 0]} stackId="stack" />
                <Bar yAxisId="left" dataKey="saidas" name="Saídas" fill="url(#saidas-gradient)" radius={[0, 0, 4, 4]} stackId="stack" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="saldoAcumulado"
                  name="Saldo acumulado"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  )
}

export default FinanceiroIndicadores
