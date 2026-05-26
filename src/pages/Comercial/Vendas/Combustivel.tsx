import { type ReactNode, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, LineChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts'
import { Fuel, Droplets, DollarSign, Receipt, TrendingUp, TrendingDown, Minus, Info, HelpCircle, Trophy } from 'lucide-react'
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
import FuelDetalheModal from '@/pages/Comercial/Vendas/FuelDetalheModal'
import BarCell from '@/components/tables/BarCell'
import ProjecaoCard from '@/components/kpi/ProjecaoCard'
import { smoothedProjection, PROJECAO_TOOLTIP } from '@/lib/projection'
import { diasEntreDatas } from '@/components/badges/cobertura'
import type { FuelTypeRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

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

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Converte "2025-10" em "Out/2025". */
const formatMonth = (yyyymm: string): string => {
  const [year, month] = yyyymm.split('-')
  const idx = parseInt(month, 10) - 1
  return `${MES_ABREV[idx] ?? month}/${year}`
}

/** Subtrai N dias de uma data ISO. */
const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

type DetalheTab = 'dia' | 'combustivel' | 'meses' | 'semana'

/**
 * Cabeçalho de coluna com ícone "?" — explica o que a métrica significa
 * via tooltip que aparece no hover. Aceita alinhamento esquerda/direita
 * pra posicionar o popover sem estourar o overflow da tabela.
 */
const ThWithHelp = ({
  label,
  help,
  align = 'right',
}: {
  label: string
  help: string
  align?: 'left' | 'right'
}) => (
  <th className={cn('px-4 py-2 font-medium', align === 'left' ? 'text-left' : 'text-right')}>
    <span className={cn('inline-flex items-center gap-1', align === 'left' ? '' : 'justify-end')}>
      {label}
      <span className="group relative inline-flex cursor-help">
        <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
        <span
          className={cn(
            'pointer-events-none absolute top-full z-50 mt-1 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          {help}
        </span>
      </span>
    </span>
  </th>
)

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
  /** Bloco rico opcional após hint (divisor + linha de contexto adicional). */
  extra?: ReactNode
  Icon: typeof Fuel
  iconBg: string
  iconColor: string
  cardBg: string
  loading: boolean
  current?: number
  previous?: number
}

const KpiCard = ({ label, value, hint, extra, Icon, iconBg, iconColor, cardBg, loading, current, previous }: KpiCardProps) => (
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
    {extra && !loading && <div className="mt-2.5 border-t border-gray-200/60 pt-2 dark:border-gray-700/60">{extra}</div>}
  </div>
)

/* ─── Página ─── */

const ComercialVendasCombustivel = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()
  const { kpis, isLoading: isLoadingKpis } = useOperacaoData()
  const { rows, dailyData, fuelTypeData, lbLitroData, projectionMeta, isLoading: isLoadingAnalytics } = useAbastecimentosAnalytics()
  const showSkeleton = useShowSkeleton(isLoadingKpis, !!kpis)

  const [detalheTab, setDetalheTab] = useState<DetalheTab>('dia')
  const [selectedDay, setSelectedDay] = useState<DetalheDiaData | null>(null)
  const [selectedFuel, setSelectedFuel] = useState<FuelTypeRow | null>(null)
  const [semanalFuelFilter, setSemanalFuelFilter] = useState('Todos')

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
   * Dois charts/tabelas:
   * 1) Litros vendidos por dia ao longo do período (linha) — filtrável por combustível
   * 2) Média de venda em litros por dia da semana × combustível (heatmap)
   *
   * Denominador da média = nº de dias distintos no dataset que caíram naquele
   * dia da semana (assim Segunda divide pelo nº de segundas do período).
   */
  const fuelOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.combustivelNome).filter(Boolean))
    return ['Todos', ...Array.from(set).sort()]
  }, [rows])

  const semanalDaily = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const r of rows) {
      if (semanalFuelFilter !== 'Todos' && r.combustivelNome !== semanalFuelFilter) continue
      const date = r.dataHora.substring(0, 10)
      if (!date) continue
      byDate.set(date, (byDate.get(date) ?? 0) + r.litros)
    }
    return Array.from(byDate.entries())
      .map(([data, litros]) => ({ data, dataFmt: formatDate(data), litros }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [rows, semanalFuelFilter])

  const semanalMatrix = useMemo(() => {
    // ordem segunda..domingo (JS getDay: 0=dom..6=sáb)
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]
    const dayLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

    // datas distintas por dia da semana
    const datesByDow = new Map<number, Set<string>>()
    // soma de litros por fuel × dia-da-semana
    const fuelDowSum = new Map<string, Map<number, number>>()

    for (const r of rows) {
      const date = r.dataHora.substring(0, 10)
      if (!date) continue
      const dow = new Date(`${date}T00:00:00`).getDay()
      const dateSet = datesByDow.get(dow) ?? new Set<string>()
      dateSet.add(date)
      datesByDow.set(dow, dateSet)

      const fuelMap = fuelDowSum.get(r.combustivelNome) ?? new Map<number, number>()
      fuelMap.set(dow, (fuelMap.get(dow) ?? 0) + r.litros)
      fuelDowSum.set(r.combustivelNome, fuelMap)
    }

    // Linhas por combustível
    const matrixRows = Array.from(fuelDowSum.entries()).map(([fuel, dowMap]) => {
      const values: number[] = []
      let totalSum = 0
      let totalDays = 0
      for (const dow of dayOrder) {
        const sum = dowMap.get(dow) ?? 0
        const days = datesByDow.get(dow)?.size ?? 0
        values.push(days > 0 ? sum / days : 0)
        totalSum += sum
        totalDays += days
      }
      return {
        nome: fuel,
        values,
        total: totalDays > 0 ? totalSum / totalDays : 0,
      }
    }).sort((a, b) => b.total - a.total)

    // Coluna total (média do dia da semana somando todos os combustíveis)
    const colValues: number[] = []
    let grandSum = 0
    let grandDays = 0
    for (const dow of dayOrder) {
      let colSum = 0
      for (const dowMap of fuelDowSum.values()) {
        colSum += dowMap.get(dow) ?? 0
      }
      const days = datesByDow.get(dow)?.size ?? 0
      colValues.push(days > 0 ? colSum / days : 0)
      grandSum += colSum
      grandDays += days
    }

    // Max absoluto pra escala do heatmap
    const allValues = matrixRows.flatMap((r) => r.values)
    const matrixMax = Math.max(...allValues, 0)

    return {
      rows: matrixRows,
      dayLabels,
      colValues,
      grandTotal: grandDays > 0 ? grandSum / grandDays : 0,
      matrixMax,
    }
  }, [rows])

  /* ─── Dados pra charts mensais (aba "Últimos 12 meses") ─── */
  const monthlyChartData = useMemo(
    () => lbLitroData.monthly.map((m) => ({
      mes: formatMonth(m.mes),
      litros: m.litros,
      lbPorLitro: m.lbPorLitro,
      faturamento: m.faturamento,
      lucroBruto: m.lucroBruto,
      margemPct: m.margemPct,
      isCurrentMonth: m.isCurrentMonth,
    })),
    [lbLitroData.monthly],
  )

  const diasPeriodo = useMemo(() => diasEntreDatas(dataInicial, dataFinal), [dataInicial, dataFinal])

  /* ─── Projeção (faturamento + lucro) ── usa smoothedProjection sobre a
   * série diária do useAbastecimentosAnalytics (dailyData tem ambos os
   * campos) e `projectionMeta.daysRemaining`. */
  const projecaoCombustivel = useMemo(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const dias = projectionMeta?.daysRemaining ?? 0
    const realizadoFat = kpis?.faturamentoCombustivel ?? 0
    const realizadoLucro = fuelTypeData.reduce((s, f) => s + f.lucroBruto, 0)
    const projetadoFat = smoothedProjection({
      realizado: realizadoFat,
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.faturamento })),
      diasRestantes: dias,
      today: todayISO,
    }).projetado
    const projetadoLucro = smoothedProjection({
      realizado: realizadoLucro,
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.lucroBruto })),
      diasRestantes: dias,
      today: todayISO,
    }).projetado
    return {
      realizadoFat,
      realizadoLucro,
      projetadoFat,
      projetadoLucro,
      isProjetada: dias > 0,
    }
  }, [kpis, fuelTypeData, dailyData, projectionMeta])

  /* ─── Projeção POR COMBUSTÍVEL ───
   * Agrega `rows` (abastecimentos brutos) por combustivelNome + dia e aplica
   * smoothedProjection em cada um. Reusa `projectionMeta.daysRemaining`. */
  const projecaoPorFuel = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>()
    const dias = projectionMeta?.daysRemaining ?? 0
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const serieByFuel = new Map<string, Map<string, number>>()
    for (const r of rows) {
      const day = r.dataHora?.substring(0, 10)
      if (!day || !r.combustivelNome) continue
      const serie = serieByFuel.get(r.combustivelNome) ?? new Map<string, number>()
      serie.set(day, (serie.get(day) ?? 0) + r.valorTotal)
      serieByFuel.set(r.combustivelNome, serie)
    }

    for (const f of fuelTypeData) {
      const serie = serieByFuel.get(f.nome) ?? new Map<string, number>()
      const projetado = smoothedProjection({
        realizado: f.faturamento,
        dailySeries: Array.from(serie.entries()).map(([data, value]) => ({ data, value })),
        diasRestantes: dias,
        today: todayISO,
      }).projetado
      out.set(f.nome, projetado)
    }
    return out
  }, [rows, fuelTypeData, projectionMeta])

  /* ─── Máximos por coluna (Power BI Data Bars) ─── */
  const colMax = useMemo(() => {
    const days = detalheDiaADia.days
    if (days.length === 0) {
      return { litros: 0, faturamento: 0, lucroBruto: 0, margem: 0, lbLitro: 0 }
    }
    return {
      litros: Math.max(...days.map((d) => d.litros)),
      faturamento: Math.max(...days.map((d) => d.faturamento)),
      lucroBruto: Math.max(...days.map((d) => d.lucroBruto)),
      margem: Math.max(...days.map((d) => (d.faturamento > 0 ? (d.lucroBruto / d.faturamento) * 100 : 0))),
      lbLitro: Math.max(...days.map((d) => (d.litros > 0 ? d.lucroBruto / d.litros : 0))),
    }
  }, [detalheDiaADia])

  /* ─── Ranking maior/menor L.B./Litro entre os combustíveis ─── */
  const lbRanking = useMemo(() => {
    if (fuelTypeData.length < 2) return null
    const sorted = [...fuelTypeData].sort((a, b) => b.lbPorLitro - a.lbPorLitro)
    return { maior: sorted[0], menor: sorted[sorted.length - 1] }
  }, [fuelTypeData])

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
          {/* KPIs principais — 4 cards + Projeção (5º) ocupando a largura
              toda. Em mobile/tablet empilha em 2 ou 3 cols. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
              extra={
                kpis && kpis.totalLitros > 0 && fuelTypeData.length > 0 ? (
                  <>
                    {/* Stacked bar com a composição por tipo de combustível */}
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      {fuelTypeData.map((f) => {
                        const pct = (f.litros / kpis.totalLitros) * 100
                        return pct > 0 ? (
                          <span
                            key={f.produtoCodigo}
                            className={cn('h-full', fuelColor(f.nome))}
                            style={{ width: `${pct}%` }}
                            title={`${f.nome}: ${pct.toFixed(1).replace('.', ',')}%`}
                          />
                        ) : null
                      })}
                    </div>
                    <p className="mt-1.5 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                      Mix por tipo de combustível
                    </p>
                  </>
                ) : null
              }
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
              extra={
                kpis && kpis.totalAbastecimentos > 0 ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Abastecimentos</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatNumber(kpis.totalAbastecimentos)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Média / dia</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrency(kpis.faturamentoCombustivel / diasPeriodo)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
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
              extra={
                kpis && kpis.totalAbastecimentos > 0 ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>L / abastecimento</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatNumber(kpis.totalLitros / kpis.totalAbastecimentos)} L
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Abastec. / dia</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatNumber(Math.round(kpis.totalAbastecimentos / diasPeriodo))}
                      </span>
                    </div>
                  </div>
                ) : null
              }
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
              extra={
                lbRanking ? (
                  <div className="space-y-1 text-[10px] tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <span className={cn('h-2 w-2 rounded-sm', fuelColor(lbRanking.maior.nome))} />
                        Maior · {lbRanking.maior.nome}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(lbRanking.maior.lbPorLitro)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <span className={cn('h-2 w-2 rounded-sm', fuelColor(lbRanking.menor.nome))} />
                        Menor · {lbRanking.menor.nome}
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(lbRanking.menor.lbPorLitro)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <ProjecaoCard
              realizadoFaturamento={projecaoCombustivel.realizadoFat}
              projetadoFaturamento={projecaoCombustivel.projetadoFat}
              realizadoLucro={projecaoCombustivel.realizadoLucro}
              projetadoLucro={projecaoCombustivel.projetadoLucro}
              dataFinal={dataFinal}
              isProjetada={projecaoCombustivel.isProjetada}
              loading={isLoadingAnalytics || isLoadingKpis}
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
                                <td className="px-2 py-1">
                                  <BarCell value={d.litros} max={colMax.litros} formatted={formatNumber(d.litros)} color="blue" align="near" />
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
                                <td className="px-2 py-1">
                                  <BarCell value={d.faturamento} max={colMax.faturamento} formatted={formatCurrency(d.faturamento)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={d.lucroBruto} max={colMax.lucroBruto} formatted={formatCurrency(d.lucroBruto)} color="green" align="near" />
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                  {formatCurrency(d.acrescimos)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                  {formatCurrency(d.descontos)}
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={margemPct} max={colMax.margem} formatted={`${margemPct.toFixed(2).replace('.', ',')}%`} color="amber" align="near" />
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                  {formatCurrency(precoVenda)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                  {formatCurrency(precoCusto)}
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={lbLitro} max={colMax.lbLitro} formatted={formatCurrency(lbLitro)} color="amber" align="near" />
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
                            <ThWithHelp align="left" label="Combustível" help="Tipo de combustível vendido no período." />
                            <ThWithHelp label="Litros" help="Volume total vendido no período (L)." />
                            <ThWithHelp label="Preço méd." help="Preço médio de venda por litro: faturamento ÷ litros." />
                            <ThWithHelp label="Custo méd." help="Custo médio de aquisição por litro (vindo do LMC)." />
                            <ThWithHelp label="L.B./Litro" help="Lucro bruto por litro: preço médio − custo médio (R$/L)." />
                            <ThWithHelp label="Faturamento" help="Receita total da venda desse combustível (R$)." />
                            <ThWithHelp label="Projeção" help={PROJECAO_TOOLTIP} />
                            <ThWithHelp label="Lucro bruto" help="Lucro bruto total: faturamento − custo (R$)." />
                            <ThWithHelp label="Margem %" help="(Lucro bruto ÷ faturamento) × 100." />
                            <ThWithHelp label="% vol" help="Participação no volume total de litros do período." />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {(() => {
                            // Máximos por coluna pra escalar as barras do tab "Por combustível"
                            const maxLitros = Math.max(...mix.map((f) => f.litros), 0)
                            const maxFat = Math.max(...mix.map((f) => f.faturamento), 0)
                            const maxProj = Math.max(...mix.map((f) => projecaoPorFuel.get(f.nome) ?? 0), 0)
                            const maxLucroBruto = Math.max(...mix.map((f) => f.lucroBruto), 0)
                            const maxLb = Math.max(...mix.map((f) => f.lbPorLitro), 0)
                            const maxMargem = Math.max(...mix.map((f) => f.margem), 0)
                            const maxParticipacao = Math.max(...mix.map((f) => f.participacao), 0)
                            // Totais agregados — alimentam a linha "Total" no rodapé
                            const totLitros = mix.reduce((s, f) => s + f.litros, 0)
                            const totFat = mix.reduce((s, f) => s + f.faturamento, 0)
                            const totProj = mix.reduce((s, f) => s + (projecaoPorFuel.get(f.nome) ?? 0), 0)
                            const totLucroBruto = mix.reduce((s, f) => s + f.lucroBruto, 0)
                            const totCusto = mix.reduce((s, f) => s + f.custo, 0)
                            const totMargemPct = totFat > 0 ? (totLucroBruto / totFat) * 100 : 0
                            const totPrecoMed = totLitros > 0 ? totFat / totLitros : 0
                            const totCustoMed = totLitros > 0 ? totCusto / totLitros : 0
                            const totLbLitro = totLitros > 0 ? totLucroBruto / totLitros : 0
                            const isProjetadaFuel = (projectionMeta?.daysRemaining ?? 0) > 0
                            return (
                              <>
                                {mix.map((f) => (
                                  <tr
                                    key={f.produtoCodigo}
                                    className="cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                                    onClick={() => setSelectedFuel(f)}
                                  >
                                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                      <span className="flex items-center gap-2">
                                        <span className={cn('h-2 w-2 rounded-full', fuelColor(f.nome))} aria-hidden="true" />
                                        <span className="truncate underline-offset-4 hover:underline" title={f.nome}>{f.nome}</span>
                                      </span>
                                    </td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.litros} max={maxLitros} formatted={formatNumber(f.litros)} color="blue" align="near" />
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.precoMedioVenda)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.precoCustoMedio)}</td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.lbPorLitro} max={maxLb} formatted={formatCurrency(f.lbPorLitro)} color="amber" align="near" />
                                    </td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.faturamento} max={maxFat} formatted={formatCurrency(f.faturamento)} color="green" align="near" />
                                    </td>
                                    <td className="px-2 py-1">
                                      {(() => {
                                        const proj = projecaoPorFuel.get(f.nome) ?? f.faturamento
                                        return <BarCell value={proj} max={maxProj} formatted={formatCurrency(proj)} color={isProjetadaFuel ? 'blue' : 'green'} align="near" />
                                      })()}
                                    </td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.lucroBruto} max={maxLucroBruto} formatted={formatCurrency(f.lucroBruto)} color="green" align="near" />
                                    </td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.margem} max={maxMargem} formatted={`${f.margem.toFixed(1).replace('.', ',')}%`} color="amber" align="near" />
                                    </td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.participacao} max={maxParticipacao} formatted={`${f.participacao.toFixed(1).replace('.', ',')}%`} color="blue" align="near" />
                                    </td>
                                  </tr>
                                ))}
                                {/* Linha Total */}
                                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                                  <td className="px-4 py-2.5">Total</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totLitros)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totPrecoMed)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totCustoMed)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totLbLitro)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totFat)}</td>
                                  <td className={cn(
                                    'px-4 py-2.5 text-right tabular-nums',
                                    isProjetadaFuel && 'text-blue-700 dark:text-blue-400',
                                  )}>
                                    {formatCurrency(totProj)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totLucroBruto)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{totMargemPct.toFixed(1).replace('.', ',')}%</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">100,0%</td>
                                </tr>
                              </>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* ── Tab: Últimos 12 meses ── */}
                {detalheTab === 'meses' && (
                  monthlyChartData.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">
                      Sem dados mensais.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                      {/* Chart 1: Litros (bar) + L.B./Litro (line) */}
                      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Litros vendidos e L.B./Litro por mês
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={monthlyChartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 10, fill: '#9ca3af' }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => formatCurrency(v)}
                            />
                            <Tooltip
                              formatter={((value: number, name: string) =>
                                name === 'L.B./Litro' ? [formatCurrency(value), name] : [formatNumber(value), name]
                              ) as never}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                            <Bar yAxisId="left" dataKey="litros" name="Litros vendidos" fill="#1e3a5f" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="litros" position="top" formatter={((v: number) => formatNumber(v)) as never} style={{ fontSize: 10, fill: '#374151' }} />
                            </Bar>
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="lbPorLitro"
                              name="L.B./Litro"
                              stroke="#facc15"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#facc15', stroke: '#a16207', strokeWidth: 1 }}
                              activeDot={{ r: 5 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Chart 2: Lucro bruto (bar) + Margem % (line) */}
                      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Lucro bruto e Margem por mês
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={monthlyChartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 10, fill: '#9ca3af' }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => `${v.toFixed(1)}%`}
                            />
                            <Tooltip
                              formatter={((value: number, name: string) =>
                                name === 'Margem' ? [`${value.toFixed(2).replace('.', ',')}%`, name] : [formatCurrency(value), name]
                              ) as never}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                            <Bar yAxisId="left" dataKey="lucroBruto" name="Lucro bruto" fill="#1e3a5f" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="lucroBruto" position="top" formatter={((v: number) => formatCurrency(v)) as never} style={{ fontSize: 10, fill: '#374151' }} />
                            </Bar>
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="margemPct"
                              name="Margem"
                              stroke="#facc15"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#facc15', stroke: '#a16207', strokeWidth: 1 }}
                              activeDot={{ r: 5 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )
                )}

                {/* ── Tab: Análise semanal ── */}
                {detalheTab === 'semana' && (
                  semanalDaily.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">
                      Sem vendas no período.
                    </div>
                  ) : semanalDaily.length < 2 ? (
                    <div className="m-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-8 text-center dark:border-amber-700/50 dark:bg-amber-900/10">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Análise semanal precisa de mais de um dia
                      </h3>
                      <p className="mx-auto mt-1 max-w-md text-xs text-gray-600 dark:text-gray-400">
                        O gráfico de evolução diária e a comparação por dia da semana só fazem sentido
                        quando o período filtrado tem pelo menos 2 dias. Amplie o intervalo de datas
                        na barra superior para visualizar a análise.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                      {/* Left: chart "Litros vendidos por dia" com filtro por combustível */}
                      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Litros vendidos por dia
                          </h3>
                          <select
                            value={semanalFuelFilter}
                            onChange={(e) => setSemanalFuelFilter(e.target.value)}
                            className="h-7 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {fuelOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <ResponsiveContainer width="100%" height={320}>
                          <LineChart data={semanalDaily} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                            <XAxis dataKey="dataFmt" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                            <Tooltip
                              formatter={((value: number) => [formatNumber(value), 'Litros']) as never}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="litros"
                              stroke="#1e3a5f"
                              strokeWidth={2}
                              dot={{ r: 3, fill: '#1e3a5f' }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Right: heatmap "Média por dia da semana × combustível" */}
                      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Média de venda em litros · Por dia da semana
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                              <tr>
                                <th className="py-1.5 pr-3 text-left font-medium">Combustível</th>
                                {semanalMatrix.dayLabels.map((d) => (
                                  <th key={d} className="px-2 py-1.5 text-right font-medium">{d}</th>
                                ))}
                                <th className="px-2 py-1.5 text-right font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {semanalMatrix.rows.map((row, rowIdx) => (
                                <tr key={row.nome}>
                                  <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center gap-1.5">
                                      <span className={cn('h-2 w-2 rounded-full', fuelColor(row.nome))} aria-hidden="true" />
                                      <span className="truncate" title={row.nome}>{row.nome}</span>
                                      {/* Markers de líder e lanterna — rows já vem ordenado por
                                          média total desc, então primeiro = melhor e último = pior. */}
                                      {rowIdx === 0 && (
                                        <span
                                          className="inline-flex shrink-0"
                                          title="Maior média do período"
                                          aria-label="Maior média do período"
                                        >
                                          <Trophy className="h-3 w-3 text-amber-500" />
                                        </span>
                                      )}
                                      {rowIdx === semanalMatrix.rows.length - 1 && semanalMatrix.rows.length > 1 && (
                                        <span
                                          className="inline-flex shrink-0"
                                          title="Menor média do período"
                                          aria-label="Menor média do período"
                                        >
                                          <TrendingDown className="h-3 w-3 text-red-500" />
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  {row.values.map((v, i) => {
                                    const intensity = semanalMatrix.matrixMax > 0
                                      ? 0.05 + (v / semanalMatrix.matrixMax) * 0.55
                                      : 0
                                    return (
                                      <td
                                        key={i}
                                        className="px-2 py-1.5 text-right tabular-nums"
                                        style={{ backgroundColor: `rgba(30, 58, 95, ${intensity})` }}
                                      >
                                        {formatNumber(Math.round(v))}
                                      </td>
                                    )
                                  })}
                                  <td className="px-2 py-1.5 text-right tabular-nums font-bold text-gray-900 dark:text-gray-100">
                                    {formatNumber(Math.round(row.total))}
                                  </td>
                                </tr>
                              ))}
                              {/* Linha de totais */}
                              <tr className="border-t-2 border-gray-300 font-bold text-gray-900 dark:border-gray-600 dark:text-gray-100">
                                <td className="py-2 pr-3">Total</td>
                                {semanalMatrix.colValues.map((v, i) => (
                                  <td key={i} className="px-2 py-2 text-right tabular-nums">
                                    {formatNumber(Math.round(v))}
                                  </td>
                                ))}
                                <td className="px-2 py-2 text-right tabular-nums">
                                  {formatNumber(Math.round(semanalMatrix.grandTotal))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
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

      {/* Modal ao clicar numa linha da aba "Realizado - por combustível":
          indicadores, top frentistas, top bombas e distribuição horária. */}
      <FuelDetalheModal
        open={selectedFuel !== null}
        onClose={() => setSelectedFuel(null)}
        fuel={selectedFuel}
        rows={rows}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        fuelColor={fuelColor}
      />
    </div>
  )
}

export default ComercialVendasCombustivel
