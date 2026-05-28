import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, Banknote, CreditCard, Smartphone, ChevronDown, Search, TrendingUp, Scale, Clock, CheckCircle2, HelpCircle, Filter, LayoutDashboard } from 'lucide-react'
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
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber, formatDate } from '@/lib/formatters'
import { cn, isPastPeriod } from '@/lib/utils'
import type { CaixaResumo, PagamentoBreakdown, TurnoGroup, ApuradoPorDia, OperacaoKpiData } from '@/pages/Operacao/hooks/useOperacaoData'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import TurnoDetalheModal from '@/pages/Operacao/components/TurnoDetalheModal'

interface CaixaPostoProps {
  /** KPIs do módulo — renderizados como primeira seção da aba Visão Geral. */
  kpis: OperacaoKpiData | undefined
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

const WEEKDAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Dia da semana em pt-BR a partir de yyyy-MM-dd (UTC-safe). */
const weekdayPtBr = (iso: string): string => {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  // new Date(yyyy, mm-1, dd) usa fuso local — suficiente pra weekday.
  return WEEKDAYS_PT[new Date(y, m - 1, d).getDay()] ?? ''
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

const CaixaPosto = ({ kpis, caixaResumo, pagamentoBreakdown, turnoGroups, apuradoPorDia }: CaixaPostoProps) => {
  const { dataInicial, dataFinal } = useFilterStore()
  // Em período passado não faz sentido mostrar "ao vivo" — todos os caixas já
  // foram fechados (em teoria). Esconde indicadores e força filtro pra 'todos'.
  const periodIsPast = isPastPeriod(dataFinal)
  // Turno selecionado — abre o modal de detalhes (substitui expansão inline)
  const [selectedTurno, setSelectedTurno] = useState<TurnoGroup | null>(null)
  // Dias que o usuário toggou manualmente. O default depende do estado do dia:
  //   - dia com algum turno ao vivo  → expandido (mostra o que tá rolando)
  //   - dia 100% fechado             → colapsado (só o header, usuário clica pra abrir)
  // Estar nesse Set inverte o default daquele dia.
  const [dayOverrides, setDayOverrides] = useState<Set<string>>(new Set())
  // Aba ativa — espelha o padrão de tabs do módulo Vendas.
  const [activeTab, setActiveTab] = useState<'visao' | 'turnos'>('visao')
  const totalPagamentos = pagamentoBreakdown.reduce((s, p) => s + p.valor, 0)
  const totalTransacoes = pagamentoBreakdown.reduce((s, p) => s + p.quantidade, 0)

  // Filters
  const [filterNome, setFilterNome] = useState('')
  const [filterTurno, setFilterTurno] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'aberto' | 'fechado'>(
    periodIsPast ? 'todos' : 'aberto'
  )
  const [filterDiferenca, setFilterDiferenca] = useState<'todas' | 'com' | 'sem'>('todas')

  // Em período passado o filtro "aberto" pode ficar vazio (caixas já foram
  // fechados) — reseta pra 'todos' pra não dar a impressão de "sem dados".
  if (periodIsPast && filterStatus === 'aberto') {
    setFilterStatus('todos')
  }

  // Filtros vindos dos gráficos (mutuamente exclusivos)
  const [selectedPgto, setSelectedPgto] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  // Detecta mudança de período pra resetar seleções (padrão "store info from
  // previous renders" da doc do React, mais limpo que useEffect + setState).
  const periodKey = `${dataInicial}-${dataFinal}`
  const [prevPeriodKey, setPrevPeriodKey] = useState(periodKey)
  if (prevPeriodKey !== periodKey) {
    setPrevPeriodKey(periodKey)
    setSelectedPgto(null)
    setSelectedDay(null)
  }

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
        if (filterStatus === 'aberto' && g.fechado) return false
        if (filterStatus === 'fechado' && !g.fechado) return false
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

  // Agrupa os filteredGroups por dataMovimento, somando apurado e diferença
  // dos turnos visíveis — bate com o que o user vê quando filtra "Com diferença"
  // (totais refletem só os turnos exibidos, não o dia inteiro).
  interface DayGroup {
    data: string
    weekday: string
    turnos: TurnoGroup[]
    apuradoTotal: number
    diferencaTotal: number
    hasAberto: boolean
  }
  const daysGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>()
    for (const g of filteredGroups) {
      const data = g.dataMovimento?.slice(0, 10) ?? ''
      if (!data) continue
      const day = map.get(data) ?? {
        data,
        weekday: weekdayPtBr(data),
        turnos: [],
        apuradoTotal: 0,
        diferencaTotal: 0,
        hasAberto: false,
      }
      day.turnos.push(g)
      day.apuradoTotal += g.apuradoTotal
      // Diferença só faz sentido em fechados — caixas abertos não entram na soma
      if (g.fechado) day.diferencaTotal += g.diferencaTotal
      if (!g.fechado) day.hasAberto = true
      map.set(data, day)
    }
    // Ordenação: mais recente primeiro
    return Array.from(map.values()).sort((a, b) => b.data.localeCompare(a.data))
  }, [filteredGroups])

  const toggleDay = (data: string) => {
    setDayOverrides((prev) => {
      const next = new Set(prev)
      if (next.has(data)) next.delete(data)
      else next.add(data)
      return next
    })
  }

  /** Considera o default (aberto pra dias com ao vivo, fechado pros demais) e
   * inverte se o usuário tiver toggado aquele dia. */
  const isDayCollapsed = (day: { data: string; hasAberto: boolean }): boolean => {
    const defaultCollapsed = !day.hasAberto
    return dayOverrides.has(day.data) ? !defaultCollapsed : defaultCollapsed
  }

  const hasActiveFilter = filterNome !== '' || filterTurno !== '' || filterStatus !== 'aberto' || filterDiferenca !== 'todas'

  const clearFilters = () => {
    setFilterNome('')
    setFilterTurno('')
    setFilterStatus('aberto')
    setFilterDiferenca('todas')
  }

  // Filtro unificado em 5 pills: Todos / Abertos / Fechados / Com diferença / Sem diferença.
  // Cada pill seta uma combinação específica de filterStatus + filterDiferenca.
  type FilterPill = 'todos' | 'aberto' | 'fechado' | 'com' | 'sem'

  const activePill: FilterPill =
    filterDiferenca === 'com'
      ? 'com'
      : filterDiferenca === 'sem'
      ? 'sem'
      : filterStatus === 'aberto'
      ? 'aberto'
      : filterStatus === 'fechado'
      ? 'fechado'
      : 'todos'

  const handleFilterPill = (pill: FilterPill) => {
    switch (pill) {
      case 'todos':
        setFilterStatus('todos')
        setFilterDiferenca('todas')
        break
      case 'aberto':
        setFilterStatus('aberto')
        setFilterDiferenca('todas')
        break
      case 'fechado':
        setFilterStatus('fechado')
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
  //  - fechado: usa g.apuradoTotal (definitivo, batido fisicamente).
  //  - aberto: alguns postos preenchem g.apuradoTotal em tempo real (PDV
  //    consolidado), outros só liberam combustível via abastecimentos. Pega
  //    o maior dos dois pra não zerar a coluna em nenhum caso. Conveniência
  //    fica embutida no apuradoTotal quando o PDV já a consolidou.
  const getApuradoEfetivo = (g: TurnoGroup): { value: number; isPartial: boolean } => {
    if (g.fechado) return { value: g.apuradoTotal, isPartial: false }
    const combustivelParcial = g.frentistas.reduce((s, f) => s + f.faturamento, 0)
    return { value: Math.max(g.apuradoTotal, combustivelParcial), isPartial: true }
  }

  const abertoGroups = turnoGroups.filter((g) => !g.fechado)

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

  const TABS: { id: 'visao' | 'turnos'; label: string; Icon: typeof Wallet; count?: number }[] = [
    { id: 'visao', label: 'Visão Geral', Icon: LayoutDashboard },
    { id: 'turnos', label: 'Turnos de Caixa', Icon: Wallet, count: turnoGroups.length },
  ]

  return (
    <div className="space-y-4">
      {/* Switcher de abas — espelha o padrão do módulo Vendas */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              )}
            >
              <tab.Icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'visao' && (
      <>
      {/* KPIs do módulo — primeira seção da aba Visão Geral */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Apurado</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {!kpis ? '—' : formatCurrency(kpis.totalApurado)}
          </p>
          {kpis && <DeltaBadge current={kpis.totalApurado} previous={kpis.cmpTotalApurado} label={kpis.comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'} />}
        </div>

        <div className={cn(
          'rounded-xl border p-5 shadow-sm',
          kpis && kpis.totalDiferenca < 0
            ? 'border-red-200 bg-gradient-to-br from-red-50/60 to-white dark:border-red-900/50 dark:from-red-950/20 dark:to-gray-900'
            : kpis && kpis.totalDiferenca > 0
            ? 'border-amber-200 bg-gradient-to-br from-amber-50/60 to-white dark:border-amber-900/50 dark:from-amber-950/20 dark:to-gray-900'
            : 'border-gray-200 bg-gradient-to-br from-gray-50/60 to-white dark:border-gray-700 dark:from-gray-800/40 dark:to-gray-900'
        )}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Diferença de Caixa</p>
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              kpis && kpis.totalDiferenca < 0
                ? 'bg-red-100 dark:bg-red-900/30'
                : kpis && kpis.totalDiferenca > 0
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
            )}>
              <Scale className={cn(
                'h-5 w-5',
                kpis && kpis.totalDiferenca < 0
                  ? 'text-red-600 dark:text-red-400'
                  : kpis && kpis.totalDiferenca > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400'
              )} />
            </div>
          </div>
          <p className={cn(
            'mt-2 text-2xl font-bold tabular-nums',
            kpis && kpis.totalDiferenca < 0
              ? 'text-red-600 dark:text-red-400'
              : kpis && kpis.totalDiferenca > 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-900 dark:text-gray-100'
          )}>
            {!kpis ? '—' : `${kpis.totalDiferenca > 0 ? '+' : ''}${formatCurrency(kpis.totalDiferenca)}`}
          </p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {kpis && kpis.totalDiferenca < 0 ? 'Falta acumulada' : kpis && kpis.totalDiferenca > 0 ? 'Sobra acumulada' : 'Caixas fechados'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-orange-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Caixas Abertos</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatNumber(caixaResumo.caixasAbertos)}
          </p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">pendentes de fechamento</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-green-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Caixas Fechados</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatNumber(caixaResumo.caixasFechados)}
          </p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">conferidos no período</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Formas de pagamento */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {pagamentoBreakdown.length > 0 ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <CreditCard className="mr-1.5 inline h-4 w-4 text-blue-500" />
                  Formas de Pagamento
                </h3>
                {dataInicial && dataFinal && (
                  <span className="text-[11px] tabular-nums text-gray-400">
                    {formatDate(dataInicial)} a {formatDate(dataFinal)}
                  </span>
                )}
              </div>

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
                  <div className="!mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Total
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(totalPagamentos)}
                      </p>
                      <p className="text-[10px] tabular-nums text-gray-400">
                        {formatNumber(totalTransacoes)} {totalTransacoes === 1 ? 'transação' : 'transações'}
                      </p>
                    </div>
                  </div>
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
      </>
      )}

      {activeTab === 'turnos' && (
      <>
      {/* Banner do filtro vindo dos gráficos da Visão Geral */}
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
              {!periodIsPast && abertoGroups.length > 0 && (
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

            {/* Filtro unificado: Todos / Abertos / Fechados / Com diferença / Sem diferença.
                "Abertos" no período corrente mostra indicador verde (live). */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
              {(
                [
                  { v: 'todos', l: 'Todos' },
                  { v: 'aberto', l: 'Abertos', live: !periodIsPast },
                  { v: 'fechado', l: 'Fechados' },
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
                {daysGroups.map((day) => {
                  const dayCollapsed = isDayCollapsed(day)
                  const dataFmt = day.data.split('-').reverse().join('/')
                  const diferencaPositiva = day.diferencaTotal > 0.005
                  return (
                    <React.Fragment key={day.data}>
                      {/* Day header — banner clicável pra colapsar/expandir os turnos do dia.
                          colSpan={7} ocupa a tabela toda; layout flex distribui informação
                          em vez de deixar as colunas (Responsáveis, Horário, Status) vazias. */}
                      <tr
                        onClick={() => toggleDay(day.data)}
                        className={cn(
                          'cursor-pointer border-y transition-colors',
                          day.hasAberto && !periodIsPast
                            ? 'border-green-200/60 bg-green-50/40 hover:bg-green-50/70 dark:border-green-900/40 dark:bg-green-900/10 dark:hover:bg-green-900/20'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900/40 dark:hover:bg-gray-800/60',
                        )}
                      >
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            {/* Esquerda — data + ao vivo + contagem */}
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              <ChevronDown className={cn(
                                'h-4 w-4 shrink-0 transition-transform',
                                dayCollapsed ? '-rotate-90 text-gray-400' : 'text-gray-500 dark:text-gray-400',
                              )} />
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dataFmt}</span>
                                <span className="text-[11px] capitalize text-gray-400">{day.weekday}</span>
                              </div>
                              <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
                                {day.turnos.length} {day.turnos.length === 1 ? 'turno' : 'turnos'}
                              </span>
                              {day.hasAberto && !periodIsPast && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-green-400 opacity-75" />
                                    <span className="relative h-1.5 w-1.5 rounded-full bg-green-500" />
                                  </span>
                                  ao vivo
                                </span>
                              )}
                            </div>

                            {/* Direita — apurado + diferença em pills */}
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400">Apurado</p>
                                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                  {formatCurrency(day.apuradoTotal)}
                                </p>
                              </div>
                              {Math.abs(day.diferencaTotal) > 0.005 ? (
                                <span className={cn(
                                  'rounded-md px-2 py-1 text-xs font-semibold tabular-nums',
                                  diferencaPositiva
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                                )}>
                                  {day.diferencaTotal > 0 ? '+' : ''}{formatCurrency(day.diferencaTotal)}
                                </span>
                              ) : (
                                <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                                  s/ diferença
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Turnos do dia — só renderiza se o dia não está colapsado */}
                      {!dayCollapsed && day.turnos.map((g, idx) => {
                        const responsaveisLabel = g.responsaveis.length <= 2
                          ? g.responsaveis.join(' · ')
                          : `${g.responsaveis.slice(0, 2).join(' · ')} (+${g.responsaveis.length - 2})`

                        return (
                          <React.Fragment key={g.groupKey}>
                      {/* Group header row */}
                      <tr
                        onClick={() => {
                          // Clicar num caixa aberto leva o filtro para "Abertos"
                          // (em vez de manter a visão "Todos" com os fechados misturados)
                          if (!g.fechado && filterStatus !== 'aberto') {
                            setFilterStatus('aberto')
                            setFilterDiferenca('todas')
                          }
                          setSelectedTurno(g)
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
                          {g.turno}
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
                          ) : periodIsPast ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Não fechado
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
                          </React.Fragment>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      <TurnoDetalheModal
        open={selectedTurno !== null}
        onClose={() => setSelectedTurno(null)}
        turno={selectedTurno}
      />
    </div>
  )
}

export default CaixaPosto
