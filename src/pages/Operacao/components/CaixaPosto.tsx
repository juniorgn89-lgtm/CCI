import { useState } from 'react'
import { Wallet, Banknote, CreditCard, Smartphone, ArrowUpDown, ChevronDown, Users, Clock, User, CheckCircle2, AlertCircle } from 'lucide-react'
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
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber, formatLiters, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { CaixaResumo, PagamentoBreakdown, TurnoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import useCaixaHistory from '@/pages/Operacao/hooks/useCaixaHistory'
import CaixaHistorico from '@/pages/Operacao/components/CaixaHistorico'

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { alteracoes, isLoading: histLoading, configured } = useCaixaHistory({ turnoRows })
  const totalPagamentos = pagamentoBreakdown.reduce((s, p) => s + p.valor, 0)

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Aggregate apurado by turno for chart
  const turnoAgg = new Map<string, number>()
  for (const t of turnoRows) {
    const prev = turnoAgg.get(t.turno) ?? 0
    turnoAgg.set(t.turno, prev + t.apurado)
  }
  const turnoChartData = Array.from(turnoAgg.entries())
    .map(([turno, valor]) => ({ turno, valor }))
    .sort((a, b) => b.valor - a.valor)

  const abertos = turnoRows.filter((t) => !t.fechado)

  return (
    <div className="space-y-4">
      {/* Currently open shifts */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Em Turno Agora</h3>
          <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600 dark:bg-green-900/20 dark:text-green-400">
            {abertos.length} aberto{abertos.length !== 1 ? 's' : ''}
          </span>
        </div>

        {abertos.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum turno aberto no momento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {abertos.map((t) => (
              <div
                key={`open-${t.caixaCodigo}-${t.turnoCodigo}`}
                className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800/50 dark:bg-green-900/10"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.funcionarioNome}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.turno}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Início: {t.abertura || '-'}</span>
                  </div>
                  <span>{formatDate(t.dataMovimento)}</span>
                </div>
                {t.apurado > 0 && (
                  <p className="mt-2 text-xs tabular-nums text-gray-500">
                    Apurado: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(t.apurado)}</span>
                  </p>
                )}
                {t.frentistas.length > 0 && (
                  <p className="mt-1 text-[10px] text-gray-400">
                    <Users className="mr-1 inline h-3 w-3" />{t.frentistas.length} frentista{t.frentistas.length !== 1 ? 's' : ''} no turno
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
                {turnoRows.map((t) => {
                  const rowKey = `${t.caixaCodigo}-${t.turnoCodigo}-${t.dataMovimento}`
                  const isExpanded = expanded.has(rowKey)
                  const hasDetails = t.frentistas.length > 0 || t.pagamentos.length > 0

                  return (
                    <>
                      <tr
                        key={rowKey}
                        onClick={() => hasDetails && toggleExpand(rowKey)}
                        className={cn(
                          'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                          hasDetails && 'cursor-pointer'
                        )}
                      >
                        <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            {hasDetails && (
                              <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
                            )}
                            <div>
                              {t.funcionarioNome}
                              {hasDetails && (
                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400">
                                  <Users className="h-3 w-3" />+{t.frentistas.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{t.turno}</td>
                        <td className="px-6 py-3 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {t.dataMovimento ? t.dataMovimento.split('-').reverse().join('/') : '-'}
                        </td>
                        <td className="px-6 py-3 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {t.abertura || '-'} - {t.fechado ? t.fechamento || '-' : 'Aberto'}
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

                      {/* Expanded details */}
                      {isExpanded && (
                        <>
                          {/* Frentistas */}
                          {t.frentistas.length > 0 && (
                            <tr key={`${rowKey}-frent-header`} className="bg-blue-50/50 dark:bg-blue-900/10">
                              <td colSpan={7} className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                <Users className="mr-1 inline h-3 w-3" />Frentistas no turno
                              </td>
                            </tr>
                          )}
                          {t.frentistas.map((f) => (
                            <tr key={`${rowKey}-${f.nome}`} className="bg-blue-50/30 dark:bg-blue-900/10">
                              <td className="py-2 pl-16 pr-6 text-xs text-gray-600 dark:text-gray-400">
                                {f.nome}
                              </td>
                              <td className="px-6 py-2 text-xs text-gray-400" />
                              <td className="px-6 py-2 text-xs text-gray-400" />
                              <td className="px-6 py-2 text-xs tabular-nums text-gray-400">
                                {formatNumber(f.atendimentos)} abast.
                              </td>
                              <td className="px-6 py-2 text-right text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                {formatCurrency(f.faturamento)}
                              </td>
                              <td className="px-6 py-2 text-right text-xs tabular-nums text-gray-400">
                                {formatLiters(f.litros)}
                              </td>
                              <td className="px-6 py-2" />
                            </tr>
                          ))}

                          {/* Detalhamento por forma de pagamento */}
                          {t.pagamentos.length > 0 && (
                            <>
                              <tr key={`${rowKey}-pgto-header`} className="bg-amber-50/50 dark:bg-amber-900/10">
                                <td colSpan={7} className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  <Wallet className="mr-1 inline h-3 w-3" />Detalhamento da diferença
                                </td>
                              </tr>
                              {t.pagamentos.map((p) => (
                                <tr key={`${rowKey}-pgto-${p.tipo}`} className="bg-amber-50/30 dark:bg-amber-900/10">
                                  <td className="py-2 pl-16 pr-6 text-xs text-gray-600 dark:text-gray-400">
                                    {p.nome}
                                  </td>
                                  <td className="px-6 py-2 text-xs text-gray-400" />
                                  <td className="px-6 py-2 text-xs text-gray-400" />
                                  <td className="px-6 py-2 text-xs tabular-nums text-gray-400">
                                    {formatNumber(p.quantidade)} transações
                                  </td>
                                  <td className="px-6 py-2 text-right text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                    {formatCurrency(p.valor)}
                                  </td>
                                  <td className="px-6 py-2 text-xs text-gray-400" />
                                  <td className="px-6 py-2" />
                                </tr>
                              ))}
                              {/* Totals row */}
                              <tr key={`${rowKey}-pgto-total`} className="bg-amber-50/50 dark:bg-amber-900/10">
                                <td className="py-2 pl-16 pr-6 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Total Vendas
                                </td>
                                <td className="px-6 py-2" />
                                <td className="px-6 py-2" />
                                <td className="px-6 py-2 text-xs text-gray-500">
                                  Apurado: {formatCurrency(t.apurado)}
                                </td>
                                <td className="px-6 py-2 text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                                  {formatCurrency(t.totalVendas)}
                                </td>
                                <td className={cn(
                                  'px-6 py-2 text-right text-xs font-semibold tabular-nums',
                                  t.diferenca > 0 ? 'text-green-600' : t.diferenca < 0 ? 'text-red-600' : 'text-gray-500'
                                )}>
                                  {t.diferenca !== 0 ? `${t.diferenca > 0 ? '+' : ''}${formatCurrency(t.diferenca)}` : '-'}
                                </td>
                                <td className="px-6 py-2" />
                              </tr>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico de alterações (Supabase) */}
      <CaixaHistorico alteracoes={alteracoes} isLoading={histLoading} configured={configured} />
    </div>
  )
}

export default CaixaPosto
