import { useMemo, useState } from 'react'
import { Fuel, Droplets, DollarSign, Receipt, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatLiters, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import DetalheDiaModal, { type DetalheDiaData } from '@/pages/Comercial/Vendas/DetalheDiaModal'

/* ─── Cores por tipo de combustível ─── */

/**
 * Cor da barra de cada tipo. Casa com a paleta usada no chart "Mix de
 * Combustíveis" do Indicadores (Operação) pra manter consistência visual
 * entre as duas telas.
 */
const fuelColor = (nome: string): string => {
  const u = nome.toUpperCase()
  if (u.includes('GASOLINA') && u.includes('ADITIVADA')) return 'bg-red-500'
  if (u.includes('GASOLINA')) return 'bg-blue-500'
  if (u.includes('ETANOL')) return 'bg-emerald-500'
  if (u.includes('DIESEL S-10') || u.includes('DIESEL S10')) return 'bg-amber-500'
  if (u.includes('DIESEL')) return 'bg-orange-500'
  if (u.includes('GNV')) return 'bg-cyan-500'
  return 'bg-gray-400'
}

/* ─── Helpers de data e formatação condicional ─── */

const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

/** Nome do dia da semana em pt-BR a partir de uma data ISO yyyy-mm-dd. */
const diaDaSemana = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`)
  return DIA_SEMANA[d.getDay()] ?? '—'
}

/** Subtrai N dias de uma data ISO. */
const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Chave da semana ISO no formato yyyy-Www (ex.: "2025-W43"). */
const isoWeekKey = (iso: string): { key: string; weekNum: number; year: number } => {
  const d = new Date(`${iso}T00:00:00`)
  // ISO 8601: semana começa segunda, semana 1 contém a 1ª quinta-feira do ano
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target.valueOf() - firstThursday.valueOf()
  const weekNum = 1 + Math.round((diff / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
  const year = target.getFullYear()
  return { key: `${year}-W${String(weekNum).padStart(2, '0')}`, weekNum, year }
}

/** Cor do badge de variação (verde >0, vermelho <0, cinza =0). */
const variationColor = (v: number): string => {
  if (v > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (v < 0) return 'text-red-600 dark:text-red-400'
  return 'text-gray-400 dark:text-gray-500'
}

/** Formata percentual estilo "+12,5%" ou "−4,2%". */
const formatPct = (v: number, digits = 2): string => {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${Math.abs(v).toFixed(digits).replace('.', ',')}%`
}

/**
 * Cor de fundo proporcional ao valor numa coluna (heatmap leve).
 * Quanto mais perto do min, mais intenso o tom. Usado pra destacar margens
 * baixas e L.B./litro fraco — mesma ideia do print do PowerBI.
 */
const heatmapAmber = (value: number, min: number, max: number): string => {
  if (max <= min || !isFinite(value)) return ''
  const ratio = (value - min) / (max - min) // 0 (baixo) → 1 (alto)
  if (ratio < 0.33) return 'bg-amber-100/70 dark:bg-amber-900/30'
  if (ratio < 0.66) return 'bg-amber-50 dark:bg-amber-900/15'
  return ''
}

const heatmapRed = (value: number, min: number, max: number): string => {
  if (max <= min || !isFinite(value)) return ''
  const ratio = (value - min) / (max - min)
  if (ratio < 0.33) return 'bg-red-100/70 dark:bg-red-900/30'
  if (ratio < 0.66) return 'bg-red-50 dark:bg-red-900/15'
  return ''
}

type DetalheTab = 'dia' | 'combustivel' | 'meses' | 'semana'

const DETALHE_TABS: { id: DetalheTab; label: string }[] = [
  { id: 'dia', label: 'Realizado dia a dia' },
  { id: 'combustivel', label: 'Realizado - por combustível' },
  { id: 'meses', label: 'Últimos 12 meses' },
  { id: 'semana', label: 'Análise semanal' },
]

/* ─── KPI card ─── */

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  Icon: typeof Fuel
  iconBg: string
  iconColor: string
  cardBg: string
  loading: boolean
  current?: number
  previous?: number
}

const KpiCard = ({ label, value, hint, Icon, iconBg, iconColor, cardBg, loading, current, previous }: KpiCardProps) => (
  <div className={cn('rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700', cardBg)}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
    </div>
    {loading ? (
      <Skeleton className="mt-2 h-8 w-32" />
    ) : (
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </p>
    )}
    {current !== undefined && previous !== undefined && !loading && (
      <DeltaBadge current={current} previous={previous} />
    )}
    {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>
)

/* ─── Página ─── */

const ComercialVendasCombustivel = () => {
  const { empresaCodigos } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()
  const { kpis, isLoading: isLoadingKpis } = useOperacaoData()
  const { rows, dailyData, fuelTypeData, lbLitroData, isLoading: isLoadingAnalytics } = useAbastecimentosAnalytics()
  const showSkeleton = useShowSkeleton(isLoadingKpis, !!kpis)

  const [detalheTab, setDetalheTab] = useState<DetalheTab>('dia')
  const [selectedDay, setSelectedDay] = useState<DetalheDiaData | null>(null)

  // Mix ordenado por participação. fuelTypeData já vem com `participacao`
  // (% sobre litros totais) calculado no hook.
  const mix = useMemo(
    () => [...fuelTypeData].sort((a, b) => b.faturamento - a.faturamento),
    [fuelTypeData],
  )

  // Margem % global (lucro bruto / faturamento).
  const margemPctGlobal = useMemo(() => {
    if (!kpis || kpis.faturamentoCombustivel <= 0) return 0
    const lb = fuelTypeData.reduce((s, f) => s + f.lucroBruto, 0)
    return (lb / kpis.faturamentoCombustivel) * 100
  }, [fuelTypeData, kpis])

  /* ─── Detalhamento DIA A DIA ───
   * Agrupa `rows` por dia (yyyy-mm-dd) e dentro de cada dia por combustivelNome.
   * Variação semanal = compara litros do dia com mesmo dia 7 dias antes
   * dentro da janela atual. Acréscimos/Descontos ficam zerados — a API
   * /ABASTECIMENTO não traz esses campos (precisa de integração futura).
   */
  const detalheDiaADia = useMemo(() => {
    interface FuelLine {
      nome: string
      litros: number
      faturamento: number
      lucroBruto: number
      custo: number
    }
    interface DayLine {
      data: string
      dayOfWeek: string
      litros: number
      faturamento: number
      lucroBruto: number
      custo: number
      acrescimos: number
      descontos: number
      variacaoSemanal: number | null
      fuels: FuelLine[]
    }

    const byDay = new Map<string, { fuels: Map<string, FuelLine>; totals: Omit<FuelLine, 'nome'> }>()
    for (const r of rows) {
      const date = r.dataHora.substring(0, 10)
      if (!date) continue
      if (!byDay.has(date)) {
        byDay.set(date, {
          fuels: new Map(),
          totals: { litros: 0, faturamento: 0, lucroBruto: 0, custo: 0 },
        })
      }
      const day = byDay.get(date)!
      const custoLinha = r.precoCusto * r.litros
      day.totals.litros += r.litros
      day.totals.faturamento += r.valorTotal
      day.totals.lucroBruto += r.lucroBruto
      day.totals.custo += custoLinha
      const prev = day.fuels.get(r.combustivelNome) ?? {
        nome: r.combustivelNome,
        litros: 0,
        faturamento: 0,
        lucroBruto: 0,
        custo: 0,
      }
      prev.litros += r.litros
      prev.faturamento += r.valorTotal
      prev.lucroBruto += r.lucroBruto
      prev.custo += custoLinha
      day.fuels.set(r.combustivelNome, prev)
    }

    const litrosPorDia = new Map<string, number>(
      Array.from(byDay.entries()).map(([d, v]) => [d, v.totals.litros]),
    )

    const days: DayLine[] = Array.from(byDay.entries())
      .map(([data, v]) => {
        const litrosSemanaAnterior = litrosPorDia.get(addDays(data, -7))
        const variacaoSemanal =
          litrosSemanaAnterior !== undefined && litrosSemanaAnterior > 0
            ? ((v.totals.litros - litrosSemanaAnterior) / litrosSemanaAnterior) * 100
            : null
        return {
          data,
          dayOfWeek: diaDaSemana(data),
          litros: v.totals.litros,
          faturamento: v.totals.faturamento,
          lucroBruto: v.totals.lucroBruto,
          custo: v.totals.custo,
          acrescimos: 0,
          descontos: 0,
          variacaoSemanal,
          fuels: Array.from(v.fuels.values()).sort((a, b) => b.faturamento - a.faturamento),
        }
      })
      .sort((a, b) => b.data.localeCompare(a.data))

    const total = days.reduce(
      (acc, d) => ({
        litros: acc.litros + d.litros,
        faturamento: acc.faturamento + d.faturamento,
        lucroBruto: acc.lucroBruto + d.lucroBruto,
        custo: acc.custo + d.custo,
        acrescimos: acc.acrescimos + d.acrescimos,
        descontos: acc.descontos + d.descontos,
      }),
      { litros: 0, faturamento: 0, lucroBruto: 0, custo: 0, acrescimos: 0, descontos: 0 },
    )
    const variacaoTotal = (() => {
      const diasVal = days.filter((d) => d.variacaoSemanal !== null)
      if (diasVal.length === 0) return null
      return diasVal.reduce((s, d) => s + (d.variacaoSemanal ?? 0), 0) / diasVal.length
    })()
    return { days, total, variacaoTotal }
  }, [rows])

  /* ─── Análise SEMANAL ───
   * Agrupa `dailyData` por semana ISO (yyyy-Www). Cada linha mostra:
   * faixa de datas, litros, faturamento, ticket médio, margem %, L.B./litro.
   */
  const detalheSemanal = useMemo(() => {
    interface WeekLine {
      key: string
      label: string
      dataInicio: string
      dataFim: string
      litros: number
      faturamento: number
      lucroBruto: number
      ticketMedio: number
      margemPct: number
      lbLitro: number
      diasComVenda: number
    }
    const byWeek = new Map<string, { weekNum: number; year: number; entries: typeof dailyData }>()
    for (const d of dailyData) {
      if (!d.data) continue
      const { key, weekNum, year } = isoWeekKey(d.data)
      const slot = byWeek.get(key) ?? { weekNum, year, entries: [] }
      slot.entries = [...slot.entries, d]
      byWeek.set(key, slot)
    }
    const weeks: WeekLine[] = Array.from(byWeek.entries())
      .map(([key, slot]) => {
        const sorted = [...slot.entries].sort((a, b) => a.data.localeCompare(b.data))
        const litros = sorted.reduce((s, e) => s + e.litros, 0)
        const faturamento = sorted.reduce((s, e) => s + e.faturamento, 0)
        const lucroBruto = sorted.reduce((s, e) => s + e.lucroBruto, 0)
        const abastecimentos = sorted.reduce((s, e) => s + e.abastecimentos, 0)
        return {
          key,
          label: `Semana ${slot.weekNum}`,
          dataInicio: sorted[0]?.data ?? '',
          dataFim: sorted[sorted.length - 1]?.data ?? '',
          litros,
          faturamento,
          lucroBruto,
          ticketMedio: abastecimentos > 0 ? faturamento / abastecimentos : 0,
          margemPct: faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0,
          lbLitro: litros > 0 ? lucroBruto / litros : 0,
          diasComVenda: sorted.length,
        }
      })
      .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio))
    return weeks
  }, [dailyData])

  /* ─── Faixas (min/max) pra heatmap de margem e L.B./litro ─── */
  const margemRange = useMemo(() => {
    const vals = detalheDiaADia.days.map((d) => (d.faturamento > 0 ? (d.lucroBruto / d.faturamento) * 100 : 0))
    if (vals.length === 0) return { min: 0, max: 0 }
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [detalheDiaADia])

  const lbLitroRange = useMemo(() => {
    const vals = detalheDiaADia.days.map((d) => (d.litros > 0 ? d.lucroBruto / d.litros : 0))
    if (vals.length === 0) return { min: 0, max: 0 }
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [detalheDiaADia])


  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/30">
            <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Vendas · Combustível{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Litros, faturamento, ticket médio e mix por tipo de combustível
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <VendasNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* KPIs — 4 cards ocupando a largura toda (grid-cols-4 no lg).
              Resumo geral do mês vai em linha separada logo abaixo. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Litros Vendidos"
              value={showSkeleton || !kpis ? '—' : formatLiters(kpis.totalLitros)}
              Icon={Droplets}
              iconBg="bg-cyan-100 dark:bg-cyan-900/30"
              iconColor="text-cyan-600 dark:text-cyan-400"
              cardBg="bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900"
              loading={showSkeleton}
              current={kpis?.totalLitros}
              previous={kpis?.prevTotalLitros}
            />
            <KpiCard
              label="Faturamento"
              value={showSkeleton || !kpis ? '—' : formatCurrency(kpis.faturamentoCombustivel)}
              Icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={showSkeleton}
              current={kpis?.faturamentoCombustivel}
              previous={kpis?.prevFaturamentoCombustivel}
            />
            <KpiCard
              label="Ticket Médio"
              value={showSkeleton || !kpis ? '—' : formatCurrency(kpis.ticketMedio)}
              Icon={Receipt}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              cardBg="bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900"
              loading={showSkeleton}
              current={kpis?.ticketMedio}
              previous={kpis?.prevTicketMedio}
            />
            <KpiCard
              label="L.B./Litro"
              value={
                isLoadingAnalytics
                  ? '—'
                  : `${formatCurrency(lbLitroData.global)} · ${margemPctGlobal.toFixed(1).replace('.', ',')}%`
              }
              hint="Lucro bruto por litro e % de margem"
              Icon={TrendingUp}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={isLoadingAnalytics}
            />
          </div>

          {/* Detalhamento de informações — 4 abas */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Detalhamento de informações
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Aqui temos todas as vendas setorizadas com maior nível de detalhes
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DETALHE_TABS.map((t) => {
                  const isActive = detalheTab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetalheTab(t.id)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                        isActive
                          ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                          : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
                      )}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Loading state — único pra todas as abas */}
            {isLoadingAnalytics ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : (
              <>
                {/* ── Tab: Realizado dia a dia ── */}
                {detalheTab === 'dia' && (
                  detalheDiaADia.days.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">
                      Sem vendas no período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Data</th>
                            <th className="px-3 py-2 text-left font-medium">Dia da semana</th>
                            <th className="px-3 py-2 text-right font-medium">Litros</th>
                            <th className="px-3 py-2 text-right font-medium">Var. semanal</th>
                            <th className="px-3 py-2 text-right font-medium">Faturamento</th>
                            <th className="px-3 py-2 text-right font-medium">Lucro bruto</th>
                            <th className="px-3 py-2 text-right font-medium">Acréscimos</th>
                            <th className="px-3 py-2 text-right font-medium">Descontos</th>
                            <th className="px-3 py-2 text-right font-medium">Margem</th>
                            <th className="px-3 py-2 text-right font-medium">Preço venda</th>
                            <th className="px-3 py-2 text-right font-medium">Preço custo</th>
                            <th className="px-3 py-2 text-right font-medium">L.B. litro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {detalheDiaADia.days.map((d) => {
                            const margemPct = d.faturamento > 0 ? (d.lucroBruto / d.faturamento) * 100 : 0
                            const precoVenda = d.litros > 0 ? d.faturamento / d.litros : 0
                            const precoCusto = d.litros > 0 ? d.custo / d.litros : 0
                            const lbLitro = d.litros > 0 ? d.lucroBruto / d.litros : 0
                            return (
                              <tr
                                key={d.data}
                                className="cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                                onClick={() => setSelectedDay(d)}
                              >
                                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                                  <span className="underline-offset-4 hover:underline">{formatDate(d.data)}</span>
                                </td>
                                <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{d.dayOfWeek}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                                  {formatNumber(d.litros)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {d.variacaoSemanal === null ? (
                                    <span className="text-gray-400">—</span>
                                  ) : (
                                    <span className={cn('inline-flex items-center justify-end gap-0.5 font-semibold', variationColor(d.variacaoSemanal))}>
                                      {formatPct(d.variacaoSemanal, 2)}
                                      {d.variacaoSemanal > 0 ? <TrendingUp className="h-3 w-3" /> : d.variacaoSemanal < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(d.faturamento)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(d.lucroBruto)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                  {formatCurrency(d.acrescimos)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                  {formatCurrency(d.descontos)}
                                </td>
                                <td className={cn(
                                  'px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100',
                                  heatmapAmber(margemPct, margemRange.min, margemRange.max),
                                )}>
                                  {margemPct.toFixed(2).replace('.', ',')}%
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                  {formatCurrency(precoVenda)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                  {formatCurrency(precoCusto)}
                                </td>
                                <td className={cn(
                                  'px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100',
                                  heatmapRed(lbLitro, lbLitroRange.min, lbLitroRange.max),
                                )}>
                                  {formatCurrency(lbLitro)}
                                </td>
                              </tr>
                            )
                          })}
                          {/* Linha Total */}
                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                            <td className="px-3 py-2.5">Total</td>
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(detalheDiaADia.total.litros)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {detalheDiaADia.variacaoTotal === null
                                ? '—'
                                : (
                                  <span className={variationColor(detalheDiaADia.variacaoTotal)}>
                                    {formatPct(detalheDiaADia.variacaoTotal, 2)}
                                  </span>
                                )}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(detalheDiaADia.total.faturamento)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(detalheDiaADia.total.lucroBruto)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(detalheDiaADia.total.acrescimos)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(detalheDiaADia.total.descontos)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {detalheDiaADia.total.faturamento > 0
                                ? `${((detalheDiaADia.total.lucroBruto / detalheDiaADia.total.faturamento) * 100).toFixed(2).replace('.', ',')}%`
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {detalheDiaADia.total.litros > 0
                                ? formatCurrency(detalheDiaADia.total.faturamento / detalheDiaADia.total.litros)
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {detalheDiaADia.total.litros > 0
                                ? formatCurrency(detalheDiaADia.total.custo / detalheDiaADia.total.litros)
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(lbLitroData.global)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* ── Tab: Realizado - por combustível ── */}
                {detalheTab === 'combustivel' && (
                  mix.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">
                      Sem vendas no período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Combustível</th>
                            <th className="px-4 py-2 text-right font-medium">Litros</th>
                            <th className="px-4 py-2 text-right font-medium">Preço méd.</th>
                            <th className="px-4 py-2 text-right font-medium">Custo méd.</th>
                            <th className="px-4 py-2 text-right font-medium">L.B./Litro</th>
                            <th className="px-4 py-2 text-right font-medium">Margem %</th>
                            <th className="px-4 py-2 text-right font-medium">Faturamento</th>
                            <th className="px-4 py-2 text-right font-medium">% mix</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {mix.map((f) => (
                            <tr key={f.produtoCodigo}>
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                <span className="flex items-center gap-2">
                                  <span className={cn('h-2 w-2 rounded-full', fuelColor(f.nome))} aria-hidden="true" />
                                  <span className="truncate" title={f.nome}>{f.nome}</span>
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(f.litros)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.precoMedioVenda)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.precoCustoMedio)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.lbPorLitro)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                {f.margem.toFixed(1).replace('.', ',')}%
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(f.faturamento)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                {f.participacao.toFixed(1).replace('.', ',')}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* ── Tab: Últimos 12 meses ── */}
                {detalheTab === 'meses' && (
                  lbLitroData.monthly.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">
                      Sem dados mensais.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Mês</th>
                            <th className="px-4 py-2 text-right font-medium">Litros</th>
                            <th className="px-4 py-2 text-right font-medium">Lucro bruto</th>
                            <th className="px-4 py-2 text-right font-medium">L.B./Litro</th>
                            <th className="px-4 py-2 text-right font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {lbLitroData.monthly.map((m) => (
                            <tr key={m.mes}>
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{m.mes}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(m.litros)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(m.lucroBruto)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(m.lbPorLitro)}</td>
                              <td className="px-4 py-2.5 text-right text-[11px]">
                                {m.isCurrentMonth ? (
                                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    Mês corrente
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* ── Tab: Análise semanal ── */}
                {detalheTab === 'semana' && (
                  detalheSemanal.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">
                      Sem vendas no período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Semana</th>
                            <th className="px-4 py-2 text-left font-medium">Período</th>
                            <th className="px-4 py-2 text-right font-medium">Dias</th>
                            <th className="px-4 py-2 text-right font-medium">Litros</th>
                            <th className="px-4 py-2 text-right font-medium">Faturamento</th>
                            <th className="px-4 py-2 text-right font-medium">Lucro bruto</th>
                            <th className="px-4 py-2 text-right font-medium">Ticket méd.</th>
                            <th className="px-4 py-2 text-right font-medium">Margem %</th>
                            <th className="px-4 py-2 text-right font-medium">L.B./Litro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {detalheSemanal.map((w) => (
                            <tr key={w.key}>
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{w.label}</td>
                              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                                {formatDate(w.dataInicio)} – {formatDate(w.dataFim)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{w.diasComVenda}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(w.litros)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(w.faturamento)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(w.lucroBruto)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(w.ticketMedio)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                {w.margemPct.toFixed(2).replace('.', ',')}%
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(w.lbLitro)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* Modal de detalhe ao clicar numa linha da aba "Realizado dia a dia" */}
      <DetalheDiaModal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        detail={selectedDay}
        fuelColor={fuelColor}
      />
    </div>
  )
}

export default ComercialVendasCombustivel
