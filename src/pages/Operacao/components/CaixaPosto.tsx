import { Wallet, Banknote, CreditCard, Smartphone, ArrowUpDown } from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { CaixaResumo, PagamentoBreakdown, TurnoRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface CaixaPostoProps {
  caixaResumo: CaixaResumo
  pagamentoBreakdown: PagamentoBreakdown[]
  turnoRows: TurnoRow[]
}

const DONUT_COLORS = [
  '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
]

const paymentIcon = (tipo: string) => {
  const t = tipo.toUpperCase()
  if (t.includes('DINHEIRO') || t.includes('ESPECIE')) return Banknote
  if (t.includes('CARTAO') || t.includes('CREDITO') || t.includes('DEBITO')) return CreditCard
  if (t.includes('PIX')) return Smartphone
  return Wallet
}

const CaixaPosto = ({ caixaResumo, pagamentoBreakdown, turnoRows }: CaixaPostoProps) => {
  const totalPagamentos = pagamentoBreakdown.reduce((s, p) => s + p.valor, 0)

  // Aggregate apurado by turno for chart
  const turnoAgg = new Map<string, number>()
  for (const t of turnoRows) {
    const prev = turnoAgg.get(t.turno) ?? 0
    turnoAgg.set(t.turno, prev + t.apurado)
  }
  const turnoChartData = Array.from(turnoAgg.entries())
    .map(([turno, valor]) => ({ turno, valor }))
    .sort((a, b) => b.valor - a.valor)

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Apurado</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(caixaResumo.totalApurado)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Diferença Total</p>
          </div>
          <p className={cn(
            'mt-1 text-xl font-bold tabular-nums',
            caixaResumo.totalDiferenca >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          )}>
            {caixaResumo.totalDiferenca >= 0 ? '+' : ''}{formatCurrency(caixaResumo.totalDiferenca)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Caixas Fechados</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatNumber(caixaResumo.caixasFechados)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Caixas Abertos</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
            {formatNumber(caixaResumo.caixasAbertos)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Payment donut */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Formas de Pagamento</h3>
          {pagamentoBreakdown.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pagamentoBreakdown}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pagamentoBreakdown.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      formatter={((v: number) => [formatCurrencyTooltip(v), 'Valor']) as never}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-3" style={{ maxHeight: 280 }}>
                {pagamentoBreakdown.map((p, i) => {
                  const pct = totalPagamentos > 0 ? (p.valor / totalPagamentos) * 100 : 0
                  const Icon = paymentIcon(p.tipo)
                  return (
                    <div key={p.tipo} className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3 w-3 text-gray-400" />
                            <span className="truncate text-sm text-gray-700 dark:text-gray-300">{p.nome}</span>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                          {formatCurrency(p.valor)} &middot; {formatNumber(p.quantidade)} transações
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Apurado by turno chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Apurado por Turno</h3>
          {turnoChartData.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, turnoChartData.length * 50)}>
              <BarChart data={turnoChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="turno" width={80} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={((v: number) => [formatCurrencyTooltip(v), 'Apurado']) as never}
                />
                <Bar dataKey="valor" name="Apurado" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Caixa sessions list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sessões de Caixa</h3>
        </div>

        {turnoRows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Nenhuma sessão de caixa no período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Funcionário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Turno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Horário</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Apurado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Diferença</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {turnoRows.map((t) => (
                  <tr key={`${t.caixaCodigo}-${t.turnoCodigo}-${t.dataMovimento}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">{t.funcionarioNome}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{t.turno}</td>
                    <td className="px-6 py-3 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {t.dataMovimento ? t.dataMovimento.split('-').reverse().join('/') : '-'}
                    </td>
                    <td className="px-6 py-3 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {t.abertura ? t.abertura.substring(0, 5) : '-'} - {t.fechado ? t.fechamento?.substring(0, 5) ?? '-' : 'Aberto'}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(t.apurado)}
                    </td>
                    <td className={cn(
                      'px-6 py-3 text-right text-sm tabular-nums',
                      !t.fechado ? 'text-gray-400' : t.diferenca > 0 ? 'text-green-600 dark:text-green-400' : t.diferenca < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
                    )}>
                      {!t.fechado ? '-' : t.diferenca !== 0 ? `${t.diferenca > 0 ? '+' : ''}${formatCurrency(t.diferenca)}` : '-'}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        t.fechado
                          ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      )}>
                        {t.fechado ? 'Fechado' : 'Aberto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default CaixaPosto
