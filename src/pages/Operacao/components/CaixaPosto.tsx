import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, Banknote, CreditCard, Smartphone, ChevronDown, Users, Search, Fuel, TrendingUp, HelpCircle, Filter } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
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
  ReferenceLine,
  ReferenceDot,
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

interface DailyChartItem {
  data: string
  label: string
  real: number | null
  projected: number | null
  isProjected: boolean
}

interface DailyTooltipProps {
  active?: boolean
  payload?: Array<{ payload: DailyChartItem }>
}

const DailyTooltip = ({ active, payload }: DailyTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0].payload
  const value = item.isProjected ? item.projected : item.real
  if (value == null) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="font-semibold text-gray-700 dark:text-gray-200">{formatDate(item.data)}</p>
      <p className={cn('mt-1', item.isProjected ? 'text-blue-500 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100')}>
        {item.isProjected ? 'Projetado' : 'Apurado'}: {formatCurrencyTooltip(value)}
        {item.isProjected && <span className="ml-1 text-gray-400">(estimativa)</span>}
      </p>
    </div>
  )
}

const CaixaPosto = ({ pagamentoBreakdown, turnoGroups, apuradoPorDia }: CaixaPostoProps) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const totalPagamentos = pagamentoBreakdown.reduce((s, p) => s + p.valor, 0)

  // Filters
  const [filterNome, setFilterNome] = useState('')
  const [filterTurno, setFilterTurno] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ao-vivo'>('ao-vivo')
  const [filterDiferenca, setFilterDiferenca] = useState<'todas' | 'com' | 'sem'>('todas')

  // Filtros vindos dos gráficos (mutuamente exclusivos)
  const [selectedPgto, setSelectedPgto] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const turnosUnicos = useMemo(() => [...new Set(turnoGroups.map((g) => g.turno))].sort(), [turnoGroups])

  const hasChartFilter = selectedPgto !== null || selectedDay !== null

  // Aplica filtros manuais + filtros vindos dos gráficos (donut, evolução diária)
  const filteredGroups = useMemo(() => {
    return turnoGroups.filter((g) => {
      if (filterNome && !g.responsaveis.some((n) => n.toLowerCase().includes(filterNome.toLowerCase()))) return false
      if (filterTurno && g.turno !== filterTurno) return false
      // Filtro de status é desabilitado quando há filtro vindo dos gráficos
      // (do contrário, o default "aberto" esconde caixas fechados que combinam com o filtro)
      if (!hasChartFilter) {
        if (filterStatus === 'ao-vivo' && g.fechado) return false
      }
      // "Com/Sem diferença" só faz sentido em caixas conferidos — exclui abertos.
      // Threshold em cents para tolerar arredondamento de float.
      if (filterDiferenca === 'com' && (!g.fechado || Math.abs(g.diferencaTotal) <= 0.005)) return false
      if (filterDiferenca === 'sem' && (!g.fechado || Math.abs(g.diferencaTotal) > 0.005)) return false
      // Filtro por forma de pagamento (donut)
      if (selectedPgto && !g.pagamentos.some((p) => p.tipo === selectedPgto)) return false
      // Filtro por dia (gráfico de evolução)
      if (selectedDay && g.dataMovimento !== selectedDay) return false
      return true
    })
  }, [turnoGroups, filterNome, filterTurno, filterStatus, filterDiferenca, selectedPgto, selectedDay, hasChartFilter])

  const hasActiveFilter = filterNome !== '' || filterTurno !== '' || filterStatus !== 'ao-vivo' || filterDiferenca !== 'todas'

  const clearFilters = () => {
    setFilterNome('')
    setFilterTurno('')
    setFilterStatus('ao-vivo')
    setFilterDiferenca('todas')
  }

  // Filtro unificado em 4 pills: Todos / Ao vivo / Com diferença / Sem diferença.
  // Cada pill seta uma combinação específica de filterStatus + filterDiferenca.
  type FilterPill = 'todos' | 'aovivo' | 'com' | 'sem'

  const activePill: FilterPill =
    filterDiferenca === 'com'
      ? 'com'
      : filterDiferenca === 'sem'
      ? 'sem'
      : filterStatus === 'ao-vivo'
      ? 'aovivo'
      : 'todos'

  const handleFilterPill = (pill: FilterPill) => {
    switch (pill) {
      case 'todos':
        setFilterStatus('todos')
        setFilterDiferenca('todas')
        break
      case 'aovivo':
        setFilterStatus('ao-vivo')
        setFilterDiferenca('todas')
        break
      case 'com':
        setFilterStatus('todos')
        setFilterDiferenca('com')
        break
      case 'sem':
        setFilterStatus('todos')
        setFilterDiferenca('sem')
        break
    }
  }

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Chart data + projection (real até hoje, projetado nos dias futuros do período)
  const { dailyChartData, todayLabel, monthProjection, realSum, showProjection } = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const realPast = apuradoPorDia.filter((d) => d.data <= todayStr)
    const last7 = realPast.slice(-7)
    const last7Avg = last7.length > 0 ? last7.reduce((s, d) => s + d.apurado, 0) / last7.length : 0
    const futureCount = apuradoPorDia.filter((d) => d.data > todayStr).length

    const data: DailyChartItem[] = apuradoPorDia.map((d) => {
      const isFuture = d.data > todayStr
      const isToday = d.data === todayStr
      return {
        data: d.data,
        label: d.data.split('-').slice(1).reverse().join('/'),
        // Real: passado e dia atual
        real: !isFuture ? d.apurado : null,
        // Projetado: dia atual (faz a transição visual ligar) + futuros
        projected: isFuture ? last7Avg : isToday ? d.apurado : null,
        isProjected: isFuture,
      }
    })

    const todayItem = data.find((d) => d.data === todayStr)
    const realSum = realPast.reduce((s, d) => s + d.apurado, 0)
    const monthProj = realSum + last7Avg * futureCount

    return {
      dailyChartData: data,
      todayLabel: todayItem?.label ?? null,
      monthProjection: monthProj,
      realSum,
      showProjection: futureCount > 0 && last7Avg > 0,
    }
  }, [apuradoPorDia])

  // Reseta seleções dos gráficos só quando o período muda (string estável,
  // diferente das refs de array que mudavam em re-renders do parent e
  // estavam apagando a seleção logo após o clique)
  useEffect(() => {
    setSelectedPgto(null)
    setSelectedDay(null)
  }, [dataInicial, dataFinal])

  // Indexação para cálculo da janela ±3 dias
  const dailyByLabel = useMemo(() => {
    const map = new Map<string, { idx: number; value: number | null }>()
    dailyChartData.forEach((d, idx) => {
      map.set(d.data, { idx, value: d.real ?? d.projected ?? null })
    })
    return map
  }, [dailyChartData])

  const selectedDayInfo = selectedDay ? dailyByLabel.get(selectedDay) : null

  // Adiciona campo "realNear" para a área da janela ±3 dias
  const dailyChartDataWithWindow = useMemo(() => {
    if (!selectedDay || !selectedDayInfo) return dailyChartData
    return dailyChartData.map((d, idx) => {
      const inWindow = Math.abs(idx - selectedDayInfo.idx) <= 3
      return { ...d, realNear: inWindow ? d.real : null }
    })
  }, [dailyChartData, selectedDay, selectedDayInfo])

  // Popover de explicação da projeção
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!helpOpen) return
    const onClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [helpOpen])

  // Nome legível da forma de pagamento selecionada (para labels)
  const selectedPgtoNome = selectedPgto
    ? pagamentoBreakdown.find((p) => p.tipo === selectedPgto)?.nome ?? selectedPgto
    : null

  // Valor de uma forma de pagamento específica num turno (0 se ausente)
  const getPgtoValor = (g: TurnoGroup, tipo: string): number =>
    g.pagamentos.find((p) => p.tipo === tipo)?.valor ?? 0

  // Apurado efetivo de um turno:
  //  - fechado: usa g.apuradoTotal (definitivo, batido fisicamente)
  //  - aberto: API ainda não preencheu apurado, então usa o combustível
  //    bombeado em tempo real (soma do faturamento dos abastecimentos do turno).
  //    Conveniência só fica disponível depois que o caixa fecha.
  const getApuradoEfetivo = (g: TurnoGroup): { value: number; isPartial: boolean } => {
    if (g.fechado) return { value: g.apuradoTotal, isPartial: false }
    const combustivelParcial = g.frentistas.reduce((s, f) => s + f.faturamento, 0)
    return { value: combustivelParcial, isPartial: true }
  }

  const abertoGroups = turnoGroups.filter((g) => !g.fechado)

  // useCaixaHistory expects turnoRows but we pass empty for now
  const { alteracoes, isLoading: histLoading, configured } = useCaixaHistory({ turnoRows: [] })

  // Resumo de diferenças (apenas turnos fechados — caixa aberto não tem
  // diferença definitiva). Tolerância de cents para tratar arredondamento.
  const diferencaSummary = useMemo(() => {
    let sobras = 0
    let faltas = 0
    let apuradoFechados = 0
    let countSobra = 0
    let countFalta = 0
    let countFechados = 0
    for (const g of filteredGroups) {
      if (!g.fechado) continue
      countFechados++
      apuradoFechados += g.apuradoTotal
      if (g.diferencaTotal > 0.005) {
        sobras += g.diferencaTotal
        countSobra++
      } else if (g.diferencaTotal < -0.005) {
        faltas += g.diferencaTotal
        countFalta++
      }
    }
    return {
      sobras,
      faltas,
      saldo: sobras + faltas,
      apuradoFechados,
      countSobra,
      countFalta,
      hasData: countSobra > 0 || countFalta > 0,
      hasFechados: countFechados > 0,
    }
  }, [filteredGroups])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Formas de pagamento */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {pagamentoBreakdown.length > 0 ? (
            <>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
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
                        onClick={(_, idx) => {
                          const item = pagamentoBreakdown[idx]
                          if (!item) return
                          setSelectedDay(null)
                          setSelectedPgto((prev) => (prev === item.tipo ? null : item.tipo))
                        }}
                      >
                        {pagamentoBreakdown.map((p, i) => {
                          const isSelected = selectedPgto === p.tipo
                          const dimmed = selectedPgto !== null && !isSelected
                          return (
                            <Cell
                              key={i}
                              fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                              fillOpacity={dimmed ? 0.3 : 1}
                              stroke={isSelected ? '#fff' : 'transparent'}
                              strokeWidth={isSelected ? 2 : 0}
                              cursor="pointer"
                            />
                          )
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                        formatter={((v: number, _name: string, item: { payload?: PagamentoBreakdown }) => {
                          const pct = totalPagamentos > 0 ? (v / totalPagamentos) * 100 : 0
                          return [`${formatCurrencyTooltip(v)} · ${pct.toFixed(1)}%`, item?.payload?.nome ?? 'Valor']
                        }) as never}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {pagamentoBreakdown.map((p, i) => {
                    const pct = totalPagamentos > 0 ? (p.valor / totalPagamentos) * 100 : 0
                    const Icon = paymentIcon(p.tipo)
                    const isSelected = selectedPgto === p.tipo
                    const dimmed = selectedPgto !== null && !isSelected
                    return (
                      <button
                        key={p.tipo}
                        onClick={() => {
                          setSelectedDay(null)
                          setSelectedPgto((prev) => (prev === p.tipo ? null : p.tipo))
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left transition-opacity hover:bg-gray-50 dark:hover:bg-gray-800/50',
                          dimmed && 'opacity-40',
                          isSelected && 'font-medium'
                        )}
                      >
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
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">Sem dados de pagamento.</div>
          )}
        </div>

        {/* Daily evolution chart com projeção */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <TrendingUp className="mr-1.5 inline h-4 w-4 text-blue-500" />
              Evolução Diária do Apurado
            </h3>
            <div className="relative flex items-center gap-1.5" ref={helpRef}>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Apurado até hoje: {formatCurrency(realSum)}
              </span>
              {showProjection && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
                  Projeção: {formatCurrency(monthProjection)}
                </span>
              )}
              {showProjection && (
                <>
                  <button
                    onClick={() => setHelpOpen((v) => !v)}
                    aria-label="Sobre a projeção"
                    aria-expanded={helpOpen}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  {helpOpen && (
                    <div
                      role="tooltip"
                      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      A projeção é calculada com base na média dos últimos 7 dias de operação, multiplicada pelos dias restantes do mês. Não considera sazonalidade ou eventos futuros.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {selectedDay && selectedDayInfo && selectedDayInfo.value !== null && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
              <span className="font-semibold">{formatDate(selectedDay)}</span>
              <span>·</span>
              <span className="tabular-nums">{formatCurrencyTooltip(selectedDayInfo.value)}</span>
              <button
                onClick={() => setSelectedDay(null)}
                className="ml-1 text-blue-500 hover:text-blue-700"
                aria-label="Limpar seleção"
              >
                ×
              </button>
            </div>
          )}

          {dailyChartData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={dailyChartDataWithWindow}
                  margin={{ top: 10, right: 16, bottom: 0, left: -8 }}
                  onClick={((e: unknown) => {
                    const evt = e as { activePayload?: Array<{ payload?: DailyChartItem }> } | undefined
                    const payload = evt?.activePayload?.[0]?.payload
                    if (payload?.data) {
                      setSelectedPgto(null)
                      setSelectedDay((prev) => (prev === payload.data ? null : payload.data))
                    }
                  }) as never}
                >
                  <defs>
                    <linearGradient id="apuradoFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="projectedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.10} />
                      <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0.02} />
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
                  <Tooltip content={<DailyTooltip />} />
                  {/* Área real (atenuada quando há seleção) */}
                  <Area
                    type="monotone"
                    dataKey="real"
                    name="Apurado"
                    stroke="#1e3a5f"
                    strokeWidth={2}
                    fill="url(#apuradoFill)"
                    fillOpacity={selectedDay ? 0.1 : 1}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {/* Janela ±3 dias destacada */}
                  {selectedDay && (
                    <Area
                      type="monotone"
                      dataKey="realNear"
                      name="Apurado (próximo)"
                      stroke="transparent"
                      fill="url(#apuradoFill)"
                      fillOpacity={0.4}
                      connectNulls={false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  )}
                  {/* Área projetada */}
                  <Area
                    type="monotone"
                    dataKey="projected"
                    name="Projetado"
                    stroke="#1e3a5f"
                    strokeOpacity={0.6}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#projectedFill)"
                    fillOpacity={selectedDay ? 0.05 : 1}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {todayLabel && (
                    <ReferenceLine
                      x={todayLabel}
                      stroke="#9ca3af"
                      strokeDasharray="2 2"
                      label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: '#6b7280' }}
                    />
                  )}
                  {selectedDay && selectedDayInfo?.value !== null && selectedDayInfo?.value !== undefined && (
                    <ReferenceDot
                      x={dailyChartData[selectedDayInfo.idx]?.label}
                      y={selectedDayInfo.value}
                      r={6}
                      fill="#1e3a5f"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Banner do filtro vindo dos gráficos */}
      {(selectedPgto || selectedDay) && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtrando por:</span>
            <span className="font-semibold">
              {selectedPgto
                ? (pagamentoBreakdown.find((p) => p.tipo === selectedPgto)?.nome ?? selectedPgto)
                : formatDate(selectedDay!)}
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedPgto(null)
              setSelectedDay(null)
            }}
            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            × limpar
          </button>
        </div>
      )}

      {/* Turno groups table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="px-6 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Turnos de Caixa
              <span className="ml-2 text-xs font-normal text-gray-400">{filteredGroups.length} de {turnoGroups.length}</span>
              {abertoGroups.length > 0 && (
                <span className="ml-3 inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  {abertoGroups.length} ao vivo
                </span>
              )}
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
        </div>

        {/* Resumo de diferenças — faixa compacta entre o título e os filtros.
            Aparece quando o filtro de status inclui fechados (Fechado ou Todos)
            e há ao menos um turno fechado na visão filtrada. */}
        {filterStatus === 'todos' && diferencaSummary.hasFechados && (
          <div
            className="flex flex-wrap items-center justify-end gap-2 border-y border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <span style={{ color: '#374151', fontSize: '13px' }}>
              Apurado fechados:{' '}
              <span style={{ fontWeight: 500 }}>{formatCurrency(diferencaSummary.apuradoFechados)}</span>
            </span>
            <span style={{ color: '#d1d5db', fontSize: '13px' }}>·</span>
            <span style={{ color: '#166534', fontSize: '13px', fontWeight: 500 }}>
              Sobras +{formatCurrency(diferencaSummary.sobras)}
              <span style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 400, marginLeft: '4px' }}>
                ({diferencaSummary.countSobra})
              </span>
            </span>
            <span style={{ color: '#d1d5db', fontSize: '13px' }}>·</span>
            <span style={{ color: '#991b1b', fontSize: '13px', fontWeight: 500 }}>
              Faltas {formatCurrency(diferencaSummary.faltas)}
              <span style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 400, marginLeft: '4px' }}>
                ({diferencaSummary.countFalta})
              </span>
            </span>
            <span style={{ color: '#d1d5db', fontSize: '13px' }}>·</span>
            <span
              style={{
                color: diferencaSummary.saldo >= 0 ? '#166534' : '#991b1b',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              Saldo {`${diferencaSummary.saldo >= 0 ? '+' : ''}${formatCurrency(diferencaSummary.saldo)}`}
            </span>
          </div>
        )}

        <div className="border-b border-gray-200 px-6 pb-4 pt-3 dark:border-gray-700">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
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
            <select
              value={filterTurno}
              onChange={(e) => setFilterTurno(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">Todos os turnos</option>
              {turnosUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Filtro unificado: Todos / Ao vivo / Com diferença / Sem diferença */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
              {(
                [
                  { v: 'todos', l: 'Todos' },
                  { v: 'aovivo', l: 'Ao vivo', live: true },
                  { v: 'com', l: 'Com diferença' },
                  { v: 'sem', l: 'Sem diferença' },
                ] as { v: FilterPill; l: string; live?: boolean }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => handleFilterPill(opt.v)}
                  className={cn(
                    'inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                    activePill === opt.v
                      ? 'bg-[#1e3a5f] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  )}
                >
                  {opt.live && (
                    <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  )}
                  {opt.l}
                </button>
              ))}
            </div>
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
                        onClick={() => {
                          // Clicar num caixa aberto leva o filtro para "Ao vivo"
                          // (em vez de manter a visão "Todos" com os fechados misturados)
                          if (!g.fechado && filterStatus !== 'ao-vivo') {
                            setFilterStatus('ao-vivo')
                            setFilterDiferenca('todas')
                          }
                          toggleExpand(g.groupKey)
                        }}
                        className={cn(
                          'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
                          !g.fechado
                            ? 'bg-green-50/30 dark:bg-green-900/10'
                            : idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30'
                        )}
                      >
                        <td
                          className={cn(
                            'px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100',
                            !g.fechado && 'border-l-4 border-green-500'
                          )}
                        >
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
                          {selectedPgto ? (
                            <>
                              {formatCurrency(getPgtoValor(g, selectedPgto))}
                              <span className="ml-1 text-[10px] font-normal text-blue-600 dark:text-blue-400">({selectedPgtoNome})</span>
                            </>
                          ) : (() => {
                            const eff = getApuradoEfetivo(g)
                            return (
                              <>
                                {formatCurrency(eff.value)}
                                {eff.isPartial && (
                                  <span className="ml-1 text-[10px] font-normal text-amber-600 dark:text-amber-400">parcial</span>
                                )}
                              </>
                            )
                          })()}
                        </td>
                        <td className={cn(
                          'px-4 py-2.5 text-right text-sm tabular-nums',
                          selectedPgto ? 'text-gray-400'
                            : !g.fechado ? 'text-gray-400'
                            : g.diferencaTotal > 0.005 ? 'text-green-600 dark:text-green-400'
                            : g.diferencaTotal < -0.005 ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500'
                        )}>
                          {selectedPgto
                            ? '—'
                            : !g.fechado
                            ? '-'
                            : Math.abs(g.diferencaTotal) > 0.005
                            ? `${g.diferencaTotal > 0 ? '+' : ''}${formatCurrency(g.diferencaTotal)}`
                            : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {g.fechado ? (
                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              Fechado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative h-2 w-2 rounded-full bg-green-500" />
                              </span>
                              Ao vivo
                            </span>
                          )}
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
                              <tr className="bg-gray-100/80 dark:bg-gray-800/50">
                                <td colSpan={7} className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                  <Wallet className="mr-1 inline h-3 w-3" />Formas de Pagamento
                                </td>
                              </tr>
                              {g.pagamentos.map((p) => {
                                const isSelected = selectedPgto === p.tipo
                                const dimmed = selectedPgto !== null && !isSelected
                                return (
                                  <tr
                                    key={`${g.groupKey}-pgto-${p.tipo}`}
                                    className={cn(
                                      isSelected
                                        ? 'bg-blue-50 font-medium dark:bg-blue-900/30'
                                        : 'bg-gray-50/80 dark:bg-gray-800/30',
                                      dimmed && 'opacity-40',
                                    )}
                                  >
                                    <td className="py-2 pl-16 pr-4 text-xs text-gray-600 dark:text-gray-400" colSpan={2}>{p.nome}</td>
                                    <td className="px-4 py-2 text-xs tabular-nums text-gray-400">{formatNumber(p.quantidade)} transações</td>
                                    <td className="px-4 py-2" />
                                    <td className={cn('px-4 py-2 text-right text-xs tabular-nums', isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400')}>
                                      {formatCurrency(p.valor)}
                                    </td>
                                    <td className="px-4 py-2" />
                                    <td className="px-4 py-2" />
                                  </tr>
                                )
                              })}
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
