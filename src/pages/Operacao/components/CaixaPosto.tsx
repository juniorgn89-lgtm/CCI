import React, { useState, useMemo } from 'react'
import { Wallet, Banknote, CreditCard, Smartphone, ChevronDown, Users, User, Search, Fuel, Clock, TrendingUp } from 'lucide-react'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber, formatLiters, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { CaixaResumo, PagamentoBreakdown, TurnoGroup, ApuradoPorDia } from '@/pages/Operacao/hooks/useOperacaoData'
import useCaixaHistory from '@/pages/Operacao/hooks/useCaixaHistory'
import CaixaHistorico from '@/pages/Operacao/components/CaixaHistorico'

interface CaixaPostoProps {
  caixaResumo: CaixaResumo
  pagamentoBreakdown: PagamentoBreakdown[]
  turnoGroups: TurnoGroup[]
  apuradoPorDia: ApuradoPorDia[]
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

const formatIsoTime = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  if (iso.includes('T')) return iso.split('T')[1]?.substring(0, 5) ?? '-'
  if (iso.includes(' ')) return iso.split(' ')[1]?.substring(0, 5) ?? '-'
  return iso.substring(0, 5)
}

const CaixaPosto = ({ pagamentoBreakdown, turnoGroups, apuradoPorDia }: CaixaPostoProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const totalPagamentos = pagamentoBreakdown.reduce((s, p) => s + p.valor, 0)

  // Filters
  const [filterNome, setFilterNome] = useState('')
  const [filterTurno, setFilterTurno] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'aberto' | 'fechado'>('aberto')
  const [filterDiferenca, setFilterDiferenca] = useState<'todas' | 'positiva' | 'negativa'>('todas')

  const turnosUnicos = useMemo(() => [...new Set(turnoGroups.map((g) => g.turno))].sort(), [turnoGroups])

  const filteredGroups = useMemo(() => {
    return turnoGroups.filter((g) => {
      if (filterNome && !g.responsaveis.some((n) => n.toLowerCase().includes(filterNome.toLowerCase()))) return false
      if (filterTurno && g.turno !== filterTurno) return false
      if (filterStatus === 'aberto' && g.fechado) return false
      if (filterStatus === 'fechado' && !g.fechado) return false
      if (filterDiferenca === 'positiva' && g.diferencaTotal <= 0) return false
      if (filterDiferenca === 'negativa' && g.diferencaTotal >= 0) return false
      return true
    })
  }, [turnoGroups, filterNome, filterTurno, filterStatus, filterDiferenca])

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

  // Chart data: daily evolution of apurado (DD/MM label + raw ISO date for tooltip)
  const dailyChartData = useMemo(
    () =>
      apuradoPorDia.map((d) => ({
        data: d.data,
        label: d.data.split('-').slice(1).reverse().join('/'),
        valor: d.apurado,
      })),
    [apuradoPorDia]
  )

  const groupSummary = useMemo(() => {
    const apurado = filteredGroups.reduce((s, g) => s + g.apuradoTotal, 0)
    const diferenca = filteredGroups.reduce((s, g) => s + g.diferencaTotal, 0)
    const fechados = filteredGroups.filter((g) => g.fechado).length
    const abertos = filteredGroups.filter((g) => !g.fechado).length
    return { apurado, diferenca, fechados, abertos }
  }, [filteredGroups])

  const abertoGroups = turnoGroups.filter((g) => !g.fechado)

  // useCaixaHistory expects turnoRows but we pass empty for now
  const { alteracoes, isLoading: histLoading, configured } = useCaixaHistory({ turnoRows: [] })

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={Wallet}
        iconColor="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-900/40"
        title="Resumo do Caixa"
        subtitle={`${filteredGroups.length} turno${filteredGroups.length !== 1 ? 's' : ''}`}
        metrics={[
          { label: 'Apurado', value: formatCurrency(groupSummary.apurado) },
          { label: 'Diferença', value: `${groupSummary.diferenca >= 0 ? '+' : ''}${formatCurrency(groupSummary.diferenca)}`, color: groupSummary.diferenca >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Fechados', value: formatNumber(groupSummary.fechados) },
          { label: 'Abertos', value: formatNumber(groupSummary.abertos), color: 'text-orange-600 dark:text-orange-400' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Formas de pagamento */}
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
                      <Pie data={pagamentoBreakdown} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                        {pagamentoBreakdown.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }} formatter={((v: number) => [formatCurrencyTooltip(v), 'Valor']) as never} />
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
                          <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">{formatCurrency(p.valor)} · {formatNumber(p.quantidade)} transações</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">Sem dados de pagamento.</div>
          )}
        </div>

        {/* Daily evolution chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <TrendingUp className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Evolução Diária do Apurado
          </h3>
          {dailyChartData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChartData} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="apuradoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tickFormatter={formatCurrencyShort}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                  labelFormatter={(_: unknown, items: ReadonlyArray<{ payload?: { data: string } }>) => {
                    const iso = items?.[0]?.payload?.data
                    return iso ? formatDate(iso) : ''
                  }}
                  formatter={((v: number) => [formatCurrencyTooltip(v), 'Apurado']) as never}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  name="Apurado"
                  stroke="#1e3a5f"
                  strokeWidth={2}
                  fill="url(#apuradoFill)"
                  fillOpacity={1}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Currently open turno groups */}
      {abertoGroups.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5">
              <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-green-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Em Turno Agora</h3>
            <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600 dark:bg-green-900/20 dark:text-green-400">
              {abertoGroups.length} turno{abertoGroups.length !== 1 ? 's' : ''} aberto{abertoGroups.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {abertoGroups.map((g) => (
              <div key={g.groupKey} className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800/50 dark:bg-green-900/10">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.turno}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{g.responsaveis.slice(0, 2).join(' · ')}{g.responsaveis.length > 2 ? ` +${g.responsaveis.length - 2}` : ''}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatIsoTime(g.abertura)}</span>
                  </div>
                  <span>{formatDate(g.dataMovimento)}</span>
                </div>
                {g.apuradoTotal > 0 && (
                  <p className="mt-2 text-xs tabular-nums text-gray-500">
                    Apurado: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(g.apuradoTotal)}</span>
                  </p>
                )}
                {g.frentistas.length > 0 && (
                  <p className="mt-1 text-[10px] text-gray-400">
                    <Users className="mr-1 inline h-3 w-3" />{g.frentistas.length} frentista{g.frentistas.length !== 1 ? 's' : ''} no turno
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Turno groups table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Turnos de Caixa
              <span className="ml-2 text-xs font-normal text-gray-400">{filteredGroups.length} de {turnoGroups.length}</span>
            </h3>
            <div className="flex items-center gap-3">
              {hasActiveFilter && (
                <button onClick={clearFilters} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  Limpar filtros
                </button>
              )}
              <button
                onClick={() => {
                  if (expanded.size > 0) setExpanded(new Set())
                  else setExpanded(new Set(filteredGroups.map((g) => g.groupKey)))
                }}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded.size > 0 && 'rotate-180')} />
                {expanded.size > 0 ? 'Minimizar todos' : 'Expandir todos'}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar responsável..."
                value={filterNome}
                onChange={(e) => setFilterNome(e.target.value)}
                className="h-8 w-[180px] rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
            <select value={filterTurno} onChange={(e) => setFilterTurno(e.target.value)} className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <option value="">Todos os turnos</option>
              {turnosUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'todos' | 'aberto' | 'fechado')} className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <option value="todos">Todos os status</option>
              <option value="aberto">Aberto</option>
              <option value="fechado">Fechado</option>
            </select>
            <select value={filterDiferenca} onChange={(e) => setFilterDiferenca(e.target.value as 'todas' | 'positiva' | 'negativa')} className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <option value="todas">Todas as diferenças</option>
              <option value="positiva">Positiva</option>
              <option value="negativa">Negativa</option>
            </select>
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            {turnoGroups.length === 0 ? 'Nenhum turno no período.' : 'Nenhum resultado para os filtros aplicados.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Turno</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Responsáveis</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Horário</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Apurado</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Diferença</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredGroups.map((g, idx) => {
                  const isExpanded = expanded.has(g.groupKey)
                  const totalCombustivel = g.frentistas.reduce((s, f) => s + f.faturamento, 0)
                  const conveniencia = Math.max(0, g.apuradoTotal - totalCombustivel)
                  const totalLitros = g.frentistas.reduce((s, f) => s + f.litros, 0)
                  const totalAbast = g.frentistas.reduce((s, f) => s + f.atendimentos, 0)
                  const responsaveisLabel = g.responsaveis.length <= 2
                    ? g.responsaveis.join(' · ')
                    : `${g.responsaveis.slice(0, 2).join(' · ')} (+${g.responsaveis.length - 2})`

                  return (
                    <React.Fragment key={g.groupKey}>
                      {/* Group header row */}
                      <tr
                        onClick={() => toggleExpand(g.groupKey)}
                        className={cn(
                          'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
                          idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30'
                        )}
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
                            {g.turno}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">{responsaveisLabel}</td>
                        <td className="px-4 py-2.5 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {g.dataMovimento ? g.dataMovimento.split('-').reverse().join('/') : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {formatIsoTime(g.abertura)} - {g.fechado ? formatIsoTime(g.fechamento) : 'Aberto'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {formatCurrency(g.apuradoTotal)}
                        </td>
                        <td className={cn(
                          'px-4 py-2.5 text-right text-sm tabular-nums',
                          !g.fechado ? 'text-gray-400' : g.diferencaTotal > 0 ? 'text-green-600 dark:text-green-400' : g.diferencaTotal < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
                        )}>
                          {!g.fechado ? '-' : g.diferencaTotal !== 0 ? `${g.diferencaTotal > 0 ? '+' : ''}${formatCurrency(g.diferencaTotal)}` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                            g.fechado ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                          )}>
                            {g.fechado ? 'Fechado' : 'Aberto'}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <>
                          {/* Abastecimentos do turno header */}
                          {g.frentistas.length > 0 && (
                            <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                              <td className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400" colSpan={2}>
                                <Users className="mr-1 inline h-3 w-3" />Abastecimentos do Turno
                              </td>
                              <td className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">Abast.</td>
                              <td className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">Litros</td>
                              <td className="px-4 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">Combustível</td>
                              <td className="px-4 py-1.5" />
                              <td className="px-4 py-1.5" />
                            </tr>
                          )}
                          {g.frentistas.map((f, fi) => (
                            <tr key={`${g.groupKey}-f-${f.nome}`} className={cn('bg-blue-50/30 dark:bg-blue-900/10', fi % 2 === 1 && 'bg-blue-50/50 dark:bg-blue-900/20')}>
                              <td className="py-2 pl-10 pr-4 text-xs text-gray-600 dark:text-gray-400" colSpan={2}>{f.nome}</td>
                              <td className="px-4 py-2 text-xs tabular-nums text-gray-400">{formatNumber(f.atendimentos)}</td>
                              <td className="px-4 py-2 text-xs tabular-nums text-gray-400">{formatLiters(f.litros)}</td>
                              <td className="px-4 py-2 text-right text-xs tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.faturamento)}</td>
                              <td className="px-4 py-2" />
                              <td className="px-4 py-2" />
                            </tr>
                          ))}

                          {/* Resumo do turno */}
                          <tr className="bg-gray-100/80 dark:bg-gray-800/50">
                            <td className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" colSpan={7}>
                              Resumo do Turno
                            </td>
                          </tr>
                          <tr className="bg-gray-50/80 dark:bg-gray-800/30">
                            <td className="py-1.5 pl-10 pr-4 text-xs text-gray-600 dark:text-gray-400" colSpan={2}>
                              <Fuel className="mr-1.5 inline h-3 w-3 text-blue-500" />Combustível
                            </td>
                            <td className="px-4 py-1.5 text-xs tabular-nums text-gray-400">{formatNumber(totalAbast)} abast.</td>
                            <td className="px-4 py-1.5 text-xs tabular-nums text-gray-400">{formatLiters(totalLitros)}</td>
                            <td className="px-4 py-1.5 text-right text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(totalCombustivel)}</td>
                            <td className="px-4 py-1.5" />
                            <td className="px-4 py-1.5" />
                          </tr>
                          {conveniencia > 0 && (
                            <tr className="bg-gray-50/80 dark:bg-gray-800/30">
                              <td className="py-1.5 pl-10 pr-4 text-xs text-gray-600 dark:text-gray-400" colSpan={2}>
                                <Wallet className="mr-1.5 inline h-3 w-3 text-green-500" />Conveniência / Outros
                              </td>
                              <td className="px-4 py-1.5" />
                              <td className="px-4 py-1.5" />
                              <td className="px-4 py-1.5 text-right text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(conveniencia)}</td>
                              <td className="px-4 py-1.5" />
                              <td className="px-4 py-1.5" />
                            </tr>
                          )}
                          <tr className="bg-gray-50/80 dark:bg-gray-800/30">
                            <td className="py-1.5 pl-10 pr-4 text-xs text-gray-600 dark:text-gray-400" colSpan={2}>Apurado no Caixa (físico)</td>
                            <td className="px-4 py-1.5" />
                            <td className="px-4 py-1.5" />
                            <td className="px-4 py-1.5 text-right text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(g.apuradoTotal)}</td>
                            <td className="px-4 py-1.5" />
                            <td className="px-4 py-1.5" />
                          </tr>
                          {g.fechado && (
                            <tr className="bg-gray-50/80 dark:bg-gray-800/30">
                              <td className="py-1.5 pl-10 pr-4 text-xs text-gray-600 dark:text-gray-400" colSpan={2}>Esperado (sistema)</td>
                              <td className="px-4 py-1.5" />
                              <td className="px-4 py-1.5" />
                              <td className="px-4 py-1.5 text-right text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(g.apuradoTotal - g.diferencaTotal)}</td>
                              <td className="px-4 py-1.5" />
                              <td className="px-4 py-1.5" />
                            </tr>
                          )}
                          {g.fechado && g.diferencaTotal !== 0 && (
                            <tr className="bg-gray-100/80 dark:bg-gray-800/50">
                              <td className="py-2 pl-10 pr-4 text-xs font-medium text-gray-800 dark:text-gray-200" colSpan={2}>Diferença</td>
                              <td className="px-4 py-2" />
                              <td className="px-4 py-2" />
                              <td className={cn('px-4 py-2 text-right text-xs font-medium tabular-nums', g.diferencaTotal > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                                {g.diferencaTotal > 0 ? '+' : ''}{formatCurrency(g.diferencaTotal)}
                              </td>
                              <td className="px-4 py-2" />
                              <td className="px-4 py-2" />
                            </tr>
                          )}

                          {/* Formas de pagamento do turno */}
                          {g.pagamentos.length > 0 && (
                            <>
                              <tr className="bg-amber-50/50 dark:bg-amber-900/10">
                                <td colSpan={7} className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                  <Wallet className="mr-1 inline h-3 w-3" />Formas de Pagamento
                                </td>
                              </tr>
                              {g.pagamentos.map((p) => (
                                <tr key={`${g.groupKey}-pgto-${p.tipo}`} className="bg-amber-50/30 dark:bg-amber-900/10">
                                  <td className="py-2 pl-16 pr-4 text-xs text-gray-600 dark:text-gray-400" colSpan={2}>{p.nome}</td>
                                  <td className="px-4 py-2 text-xs tabular-nums text-gray-400">{formatNumber(p.quantidade)} transações</td>
                                  <td className="px-4 py-2" />
                                  <td className="px-4 py-2 text-right text-xs tabular-nums text-gray-600 dark:text-gray-400">{formatCurrency(p.valor)}</td>
                                  <td className="px-4 py-2" />
                                  <td className="px-4 py-2" />
                                </tr>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CaixaHistorico alteracoes={alteracoes} isLoading={histLoading} configured={configured} />
    </div>
  )
}

export default CaixaPosto
