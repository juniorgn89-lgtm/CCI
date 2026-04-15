import { useState, useMemo } from 'react'
import { Wallet, Banknote, CreditCard, Smartphone, ArrowUpDown, ChevronDown, Users, Clock, User, CheckCircle2, AlertCircle, Search, Filter, Fuel } from 'lucide-react'
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

  // Filters
  const [filterNome, setFilterNome] = useState('')
  const [filterTurno, setFilterTurno] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'aberto' | 'fechado'>('aberto')
  const [filterDiferenca, setFilterDiferenca] = useState<'todas' | 'positiva' | 'negativa'>('todas')

  // Unique values for dropdowns
  const turnosUnicos = useMemo(() => [...new Set(turnoRows.map((t) => t.turno))].sort(), [turnoRows])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return turnoRows.filter((t) => {
      if (filterNome && !t.funcionarioNome.toLowerCase().includes(filterNome.toLowerCase())) return false
      if (filterTurno && t.turno !== filterTurno) return false
      if (filterStatus === 'aberto' && t.fechado) return false
      if (filterStatus === 'fechado' && !t.fechado) return false
      if (filterDiferenca === 'positiva' && t.diferenca <= 0) return false
      if (filterDiferenca === 'negativa' && t.diferenca >= 0) return false
      return true
    })
  }, [turnoRows, filterNome, filterTurno, filterStatus, filterDiferenca])

  const hasActiveFilter = filterNome !== '' || filterTurno !== '' || filterStatus !== 'aberto' || filterDiferenca !== 'todas'

  const clearFilters = () => {
    setFilterNome('')
    setFilterTurno('')
    setFilterStatus('aberto')
    setFilterDiferenca('todas')
  }

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
        {/* Formas de pagamento / Diferença por responsável */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {pagamentoBreakdown.length > 0 ? (
            <>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <CreditCard className="mr-1.5 inline h-4 w-4 text-blue-500" />
                Formas de Pagamento
              </h3>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pagamentoBreakdown}
                        dataKey="valor"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
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
                <div className="flex-1 space-y-2 overflow-y-auto pr-3" style={{ maxHeight: 200 }}>
                  {pagamentoBreakdown.map((p, i) => {
                    const pct = totalPagamentos > 0 ? (p.valor / totalPagamentos) * 100 : 0
                    const Icon = paymentIcon(p.tipo)
                    return (
                      <div key={p.tipo} className="flex items-center gap-3">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3 w-3 text-gray-400" />
                              <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p.nome}</span>
                            </div>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct.toFixed(1)}%</span>
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
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <ArrowUpDown className="mr-1.5 inline h-4 w-4 text-amber-500" />
                  Diferença por Responsável
                </h3>
                {filterNome && (
                  <button onClick={() => setFilterNome('')} className="text-[10px] text-blue-500 underline">limpar filtro</button>
                )}
              </div>
              {(() => {
                const fechados = turnoRows.filter((t) => t.fechado && t.diferenca !== 0)
                const diffByFunc = new Map<string, { diff: number; count: number }>()
                for (const t of fechados) {
                  const prev = diffByFunc.get(t.funcionarioNome) ?? { diff: 0, count: 0 }
                  diffByFunc.set(t.funcionarioNome, { diff: prev.diff + t.diferenca, count: prev.count + 1 })
                }
                const ranking = Array.from(diffByFunc.entries())
                  .map(([nome, d]) => ({ nome, ...d }))
                  .sort((a, b) => a.diff - b.diff)

                if (ranking.length === 0) {
                  return <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">Sem diferenças no período.</div>
                }

                return (
                  <div className="space-y-2.5">
                    {ranking.map((r) => {
                      const isActive = filterNome === r.nome
                      return (
                        <button
                          key={r.nome}
                          onClick={() => {
                            setFilterNome(isActive ? '' : r.nome)
                            setFilterStatus('todos')
                          }}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                            isActive
                              ? 'bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-900/20 dark:ring-blue-700'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900 dark:text-gray-100">{r.nome}</p>
                            <p className="text-[10px] text-gray-400">{r.count} turno{r.count > 1 ? 's' : ''}</p>
                          </div>
                          <span className={cn(
                            'shrink-0 text-sm font-bold tabular-nums',
                            r.diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          )}>
                            {r.diff > 0 ? '+' : ''}{formatCurrency(r.diff)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* Apurado por turno chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Wallet className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Apurado por Turno
          </h3>
          {turnoChartData.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <>
              {filterTurno && (
                <p className="mb-2 text-[10px] text-blue-500">
                  Filtrado por: <span className="font-semibold">{filterTurno}</span>
                  <button onClick={() => setFilterTurno('')} className="ml-2 underline">limpar</button>
                </p>
              )}
              <ResponsiveContainer width="100%" height={Math.max(180, turnoChartData.length * 60)}>
                <BarChart
                  data={turnoChartData}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                  onClick={(e) => {
                    if (e?.activeLabel) {
                      const turno = e.activeLabel as string
                      setFilterTurno(filterTurno === turno ? '' : turno)
                      setFilterStatus('todos')
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                  <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="turno" width={80} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={((v: number) => [formatCurrencyTooltip(v), 'Apurado']) as never}
                  />
                  <Bar dataKey="valor" name="Apurado" radius={[0, 6, 6, 0]}>
                    {turnoChartData.map((entry) => (
                      <Cell
                        key={entry.turno}
                        fill={filterTurno === entry.turno ? '#1d4ed8' : '#2563eb'}
                        opacity={filterTurno && filterTurno !== entry.turno ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* Currently open shifts */}
      {abertos.length > 0 && (
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
        </div>
      )}

      {/* Caixa sessions list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Sessões de Caixa
              <span className="ml-2 text-xs font-normal text-gray-400">
                {filteredRows.length} de {turnoRows.length}
              </span>
            </h3>
            <div className="flex items-center gap-3">
              {hasActiveFilter && (
                <button onClick={clearFilters} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  Limpar filtros
                </button>
              )}
              <button
                onClick={() => {
                  if (expanded.size > 0) {
                    setExpanded(new Set())
                  } else {
                    setExpanded(new Set(filteredRows.map((t) => `${t.caixaCodigo}-${t.turnoCodigo}-${t.dataMovimento}`)))
                  }
                }}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded.size > 0 && 'rotate-180')} />
                {expanded.size > 0 ? 'Minimizar todos' : 'Expandir todos'}
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar funcionário..."
                value={filterNome}
                onChange={(e) => setFilterNome(e.target.value)}
                className="h-8 w-[180px] rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
            <select
              value={filterTurno}
              onChange={(e) => setFilterTurno(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">Todos os turnos</option>
              {turnosUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'todos' | 'aberto' | 'fechado')}
              className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="todos">Todos os status</option>
              <option value="aberto">Aberto</option>
              <option value="fechado">Fechado</option>
            </select>
            <select
              value={filterDiferenca}
              onChange={(e) => setFilterDiferenca(e.target.value as 'todas' | 'positiva' | 'negativa')}
              className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="todas">Todas as diferenças</option>
              <option value="positiva">Positiva</option>
              <option value="negativa">Negativa</option>
            </select>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            {turnoRows.length === 0 ? 'Nenhuma sessão de caixa no período.' : 'Nenhum resultado para os filtros aplicados.'}
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
                {filteredRows.map((t) => {
                  const rowKey = `${t.caixaCodigo}-${t.turnoCodigo}-${t.dataMovimento}`
                  const isExpanded = expanded.has(rowKey)
                  const hasDetails = true

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
                          {/* Frentistas — sub-header com colunas */}
                          {t.frentistas.length > 0 && (
                            <tr key={`${rowKey}-frent-header`} className="bg-blue-50/50 dark:bg-blue-900/10">
                              <td className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                <Users className="mr-1 inline h-3 w-3" />Abastecimentos do responsável
                              </td>
                              <td className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Abast.</td>
                              <td className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Litros</td>
                              <td className="px-6 py-1.5" />
                              <td className="px-6 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Combustível</td>
                              <td className="px-6 py-1.5" />
                              <td className="px-6 py-1.5" />
                            </tr>
                          )}
                          {t.frentistas.map((f) => (
                            <tr key={`${rowKey}-${f.nome}`} className="bg-blue-50/30 dark:bg-blue-900/10">
                              <td className="py-2 pl-10 pr-6 text-xs text-gray-600 dark:text-gray-400">
                                {f.nome}
                              </td>
                              <td className="px-6 py-2 text-xs tabular-nums text-gray-400">
                                {formatNumber(f.atendimentos)}
                              </td>
                              <td className="px-6 py-2 text-xs tabular-nums text-gray-400">
                                {formatLiters(f.litros)}
                              </td>
                              <td className="px-6 py-2" />
                              <td className="px-6 py-2 text-right text-xs tabular-nums text-gray-700 dark:text-gray-300">
                                {formatCurrency(f.faturamento)}
                              </td>
                              <td className="px-6 py-2" />
                              <td className="px-6 py-2" />
                            </tr>
                          ))}
                          {/* Resumo: Combustível + Conveniência + Apurado + Diferença */}
                          {(() => {
                            const totalAbast = t.frentistas.reduce((s, f) => s + f.atendimentos, 0)
                            const totalLitros = t.frentistas.reduce((s, f) => s + f.litros, 0)
                            const totalCombustivel = t.frentistas.reduce((s, f) => s + f.faturamento, 0)
                            const conveniencia = Math.max(0, t.apurado - totalCombustivel)
                            return (
                              <>
                                <tr key={`${rowKey}-sum-header`} className="bg-gray-100/80 dark:bg-gray-800/50">
                                  <td className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" colSpan={7}>
                                    Resumo do Caixa
                                  </td>
                                </tr>
                                <tr key={`${rowKey}-sum-comb`} className="bg-gray-50/80 dark:bg-gray-800/30">
                                  <td className="py-1.5 pl-10 pr-6 text-xs text-gray-600 dark:text-gray-400">
                                    <Fuel className="mr-1.5 inline h-3 w-3 text-blue-500" />Combustível
                                  </td>
                                  <td className="px-6 py-1.5 text-xs tabular-nums text-gray-400">{formatNumber(totalAbast)} abast.</td>
                                  <td className="px-6 py-1.5 text-xs tabular-nums text-gray-400">{formatLiters(totalLitros)}</td>
                                  <td className="px-6 py-1.5" />
                                  <td className="px-6 py-1.5 text-right text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                    {formatCurrency(totalCombustivel)}
                                  </td>
                                  <td className="px-6 py-1.5" />
                                  <td className="px-6 py-1.5" />
                                </tr>
                                {conveniencia > 0 && (
                                  <tr key={`${rowKey}-sum-conv`} className="bg-gray-50/80 dark:bg-gray-800/30">
                                    <td className="py-1.5 pl-10 pr-6 text-xs text-gray-600 dark:text-gray-400">
                                      <Wallet className="mr-1.5 inline h-3 w-3 text-green-500" />Conveniência / Outros
                                    </td>
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5 text-right text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                      {formatCurrency(conveniencia)}
                                    </td>
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5" />
                                  </tr>
                                )}
                                <tr key={`${rowKey}-sum-apurado`} className="bg-gray-50/80 dark:bg-gray-800/30">
                                  <td className="py-1.5 pl-10 pr-6 text-xs text-gray-600 dark:text-gray-400">
                                    Apurado no Caixa (contagem física)
                                  </td>
                                  <td className="px-6 py-1.5" />
                                  <td className="px-6 py-1.5" />
                                  <td className="px-6 py-1.5" />
                                  <td className="px-6 py-1.5 text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                                    {formatCurrency(t.apurado)}
                                  </td>
                                  <td className="px-6 py-1.5" />
                                  <td className="px-6 py-1.5" />
                                </tr>
                                {t.fechado && (
                                  <tr key={`${rowKey}-sum-esperado`} className="bg-gray-50/80 dark:bg-gray-800/30">
                                    <td className="py-1.5 pl-10 pr-6 text-xs text-gray-600 dark:text-gray-400">
                                      Esperado (sistema)
                                    </td>
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5 text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                                      {formatCurrency(t.apurado - t.diferenca)}
                                    </td>
                                    <td className="px-6 py-1.5" />
                                    <td className="px-6 py-1.5" />
                                  </tr>
                                )}
                                {t.fechado && t.diferenca !== 0 && (
                                  <tr key={`${rowKey}-sum-diff`} className="bg-gray-100/80 dark:bg-gray-800/50">
                                    <td className="py-2 pl-10 pr-6 text-xs font-bold text-gray-800 dark:text-gray-200">
                                      Diferença
                                    </td>
                                    <td className="px-6 py-2" />
                                    <td className="px-6 py-2" />
                                    <td className="px-6 py-2" />
                                    <td className={cn(
                                      'px-6 py-2 text-right text-xs font-bold tabular-nums',
                                      t.diferenca > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                    )}>
                                      {t.diferenca > 0 ? '+' : ''}{formatCurrency(t.diferenca)}
                                    </td>
                                    <td className="px-6 py-2" />
                                    <td className="px-6 py-2" />
                                  </tr>
                                )}
                              </>
                            )
                          })()}

                          {/* Detalhamento por forma de pagamento */}
                          {t.pagamentos.length > 0 && (
                            <>
                              <tr key={`${rowKey}-pgto-header`} className="bg-amber-50/50 dark:bg-amber-900/10">
                                <td colSpan={7} className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  <Wallet className="mr-1 inline h-3 w-3" />Formas de Pagamento
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
