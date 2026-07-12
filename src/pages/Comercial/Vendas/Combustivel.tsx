import { type ReactNode, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts'
import { Fuel, Droplets, DollarSign, PieChart, TrendingUp, TrendingDown, Minus, Info, Trophy, ChevronDown } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { Skeleton } from '@/components/ui/skeleton'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { cn } from '@/lib/utils'
import { GROUP_TINT } from '@/lib/groupTint'
import { fuelLabel } from '@/lib/fuel'
import { formatCurrency, formatCurrencyInt, formatDate, formatLiters, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useFuelVendaCacheAnalytics from '@/pages/Operacao/hooks/useFuelVendaCacheAnalytics'
import MovimentoFiscalValidacao from '@/pages/Comercial/Vendas/MovimentoFiscalValidacao'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import DetalheDiaModal, { type DetalheDiaData } from '@/pages/Comercial/Vendas/DetalheDiaModal'
import AnaliseSemanalLineCard from '@/pages/Comercial/Vendas/AnaliseSemanalLineCard'
import FuelDetalheModal from '@/pages/Comercial/Vendas/FuelDetalheModal'
import LitrosVendidosModal from '@/pages/Comercial/Vendas/LitrosVendidosModal'
import BarCell from '@/components/tables/BarCell'
import HeaderHint from '@/components/tables/HeaderHint'
import TablePager from '@/components/tables/TablePager'
import InfoHint from '@/components/ui/InfoHint'
import RealizadoChave from '@/components/kpi/RealizadoChave'
import ProjecaoExecutiva from './ProjecaoExecutiva'
import { projecaoAvancada } from '@/lib/projection'
import type { FuelVendaFuelType } from '@/pages/Operacao/hooks/useFuelVendaAnalytics'

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

// Cor da célula do heatmap: lerp #eef4fb (claro) → #1e3a5f (navy) por intensidade.
const heatColor = (t: number): string => {
  const c = Math.max(0, Math.min(1, t))
  const r = Math.round(238 + (30 - 238) * c)
  const g = Math.round(244 + (58 - 244) * c)
  const b = Math.round(251 + (95 - 251) * c)
  return `rgb(${r}, ${g}, ${b})`
}
// Rótulos curtos (SEG..DOM) alinhados com semanalMatrix.dayLabels.
const DOW_SHORT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

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

/** Formata percentual estilo "+12,50%" ou "−4,20%". */
const formatPct = (v: number, digits = 2): string => {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${Math.abs(v).toFixed(digits).replace('.', ',')}%`
}

type DetalheTab = 'dia' | 'combustivel' | 'meses' | 'semana'

/** Cabeçalho de GRUPO (linha superior do thead) — agrupa colunas por tema.
 * `first` omite o divisor vertical à esquerda (1º grupo). */
const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-gray-800/60 dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
    {label}
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
  /** Texto de ajuda exibido num tooltip (ícone "?") ao lado do label. */
  help?: string
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
  comparisonLabel?: string
  /** Valor projetado pra fim do mês (string já formatada). Só aparece quando o
   * período é projetável (tem dias futuros). */
  projecao?: string
  /** Quebra da projeção por combustível (toggle global "Ver detalhes"). */
  projDetalhe?: ReactNode
  /** Se o detalhe por combustível deve aparecer (estado global expandido). */
  mostrarProjDetalhe?: boolean
  /** Torna o card clicável (abre o drill-down de conferência). */
  onClick?: () => void
}

const KpiCard = ({ label, value, help, hint, extra, Icon, iconBg, iconColor, cardBg, loading, current, previous, comparisonLabel, projecao, projDetalhe, mostrarProjDetalhe, onClick }: KpiCardProps) => (
  <div
    className={cn(
      'flex flex-col rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700',
      cardBg,
      onClick && 'cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
    )}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
  >
    <div className="flex items-center justify-between">
      <p className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400">
        {label}
        {help && <InfoHint text={help} />}
      </p>
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
    {/* Slot reservado pra comparação — mantém a linha de projeção alinhada
        entre todos os cards, tenham eles DeltaBadge ou não. */}
    {!loading && (
      <div className="min-h-[1.25rem]">
        {current !== undefined && previous !== undefined && (
          <DeltaBadge current={current} previous={previous} label={comparisonLabel} />
        )}
      </div>
    )}
    {projecao && !loading && (
      <p className="mt-1.5 flex items-center gap-1 text-[11px] tabular-nums text-indigo-600 dark:text-indigo-400" title="Projeção para o fim do mês">
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>Proj. fim do mês: <span className="font-semibold">{projecao}</span></span>
      </p>
    )}
    {mostrarProjDetalhe && projDetalhe && !loading && (
      <div className="mt-2 rounded-lg bg-indigo-50/70 px-2.5 py-2 dark:bg-indigo-950/20">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
          Projeção por combustível
        </p>
        {projDetalhe}
      </div>
    )}
    {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
    {/* mt-auto ancora o detalhe no rodapé — todas as seções "extra" alinham
        na base do card (alturas iguais via grid). */}
    {extra && !loading && <div className="mt-auto border-t border-gray-200/60 pt-2.5 dark:border-gray-700/60">{extra}</div>}
  </div>
)

/* ─── Página ─── */

/** Dropdown de filtro por combustível — substitui a barra de pílulas (que ficava
 * cheia com a rede toda). Compacto e limpo. Mostra `fuelLabel` (sem o "." do cadastro). */
const FuelSelect = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
  <div className="relative inline-flex items-center">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt === 'Todos' ? 'Todos os combustíveis' : fuelLabel(opt)}</option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-gray-400" />
  </div>
)

interface ComercialVendasCombustivelProps {
  /** Quando `true`, não renderiza PageHeaderTitle/Actions/SelectCompanyState/VendasNav
   * — usado quando a página é montada como aba dentro do Vendas/index. */
  embedded?: boolean
}

const ComercialVendasCombustivel = ({ embedded = false }: ComercialVendasCombustivelProps = {}) => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  // Consolidado rede-wide: a aba renderiza sempre (Todos/subconjunto/1 posto).
  // `single1Posto` libera os blocos operacionais por-posto (ritmo bomba/frentista).
  const single1Posto = empresaCodigos.length === 1
  const empresaNome = useEmpresaNome()
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  // ABASTECIMENTO só pro operacional por-posto: `rows` (modal de frentistas/
  // bombas/hora — só com 1 posto) e `lbLitroData` (gráfico 12 meses, rede-wide).
  const { rows, lbLitroData, isLoading: isLoadingAnalytics } = useAbastecimentosAnalytics()
  // VENDA fiscal CONSOLIDADA (cache apuracao_vendas) — fonte das métricas de
  // VALOR: KPIs, mix, ranking, projeção, tabela dia a dia e por combustível.
  const { rows: vendaRows, rowsSemanaAnt, dailyData, fuelTypeData, kpis: vendaKpis, cmp: vendaCmp, semanaAntLitros, isLoading: isLoadingValor } = useFuelVendaCacheAnalytics()
  const showSkeleton = useShowSkeleton(isLoadingValor, fuelTypeData.length > 0)

  const [detalheTab, setDetalheTab] = useState<DetalheTab>('dia')
  const [selectedDay, setSelectedDay] = useState<DetalheDiaData | null>(null)
  const [selectedFuel, setSelectedFuel] = useState<FuelVendaFuelType | null>(null)
  const [semanalFuelFilter, setSemanalFuelFilter] = useState('Todos')
  const [diaFuelFilter, setDiaFuelFilter] = useState('Todos')
  const [litrosModalOpen, setLitrosModalOpen] = useState(false)
  const [mesesFuelFilter, setMesesFuelFilter] = useState('Todos')
  // Página da tabela dia a dia (0-based; 0 = dias mais recentes).
  const [diaPage, setDiaPage] = useState(0)
  // Toggle global "Ver detalhes" (no card de Projeção) → expande os 4 KPIs com a
  // projeção por combustível.
  const [projDetalheAberto, setProjDetalheAberto] = useState(false)

  // Mix ordenado por participação. fuelTypeData já vem com `participacao`
  // (% sobre litros totais) calculado no hook.
  const mix = useMemo(
    () => [...fuelTypeData].sort((a, b) => b.faturamento - a.faturamento),
    [fuelTypeData],
  )

  // Margem % global — vem do hook, calculada SÓ sobre o volume com custo apurado
  // (combustível sem custo inflaria a margem). `coberturaCustoPct` sinaliza o gap.
  const margemPctGlobal = vendaKpis.margemPct

  /* ─── Detalhamento DIA A DIA ───
   * Agrupa `rows` por data fiscal e, dentro do dia, por combustivelNome.
   * Faturamento, custo (CMV) e desconto vêm do item de venda (via `rows`,
   * que casa o /VENDA_ITEM). Acréscimos ficam zerados (raros em combustível).
   * Variação semanal = litros do dia vs mesmo dia 7 dias antes na janela.
   */
  const detalheDiaADia = useMemo(() => {
    interface FuelLine {
      nome: string
      litros: number
      faturamento: number
      lucroBruto: number
      custo: number
      descontos: number
      acrescimos: number
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

    // Fonte: VENDA fiscal. Agrupa pela data de movimento
    // (já travada no período), faturamento BRUTO (totalVenda) e CMV (totalCusto).
    const src = diaFuelFilter === 'Todos' ? vendaRows : vendaRows.filter((r) => r.combustivelNome === diaFuelFilter)
    const byDay = new Map<string, { fuels: Map<string, FuelLine>; totals: Omit<FuelLine, 'nome'> }>()
    for (const r of src) {
      const date = r.data
      if (!date) continue
      if (!byDay.has(date)) {
        byDay.set(date, {
          fuels: new Map(),
          totals: { litros: 0, faturamento: 0, lucroBruto: 0, custo: 0, descontos: 0, acrescimos: 0 },
        })
      }
      const day = byDay.get(date)!
      day.totals.litros += r.litros
      day.totals.faturamento += r.faturamento
      day.totals.lucroBruto += r.lucroBruto
      day.totals.custo += r.custo
      day.totals.descontos += r.desconto
      day.totals.acrescimos += r.acrescimo
      const prev = day.fuels.get(r.combustivelNome) ?? {
        nome: r.combustivelNome,
        litros: 0,
        faturamento: 0,
        lucroBruto: 0,
        custo: 0,
        descontos: 0,
        acrescimos: 0,
      }
      prev.litros += r.litros
      prev.faturamento += r.faturamento
      prev.lucroBruto += r.lucroBruto
      prev.custo += r.custo
      prev.descontos += r.desconto
      prev.acrescimos += r.acrescimo
      day.fuels.set(r.combustivelNome, prev)
    }

    // Litros por dia da SEMANA ANTERIOR (busca dedicada de −7 dias), com o mesmo
    // filtro de combustível — pra variação do dia bater com a tabela por
    // combustível mesmo quando o período não inclui a semana anterior.
    const srcSem = diaFuelFilter === 'Todos' ? rowsSemanaAnt : rowsSemanaAnt.filter((r) => r.combustivelNome === diaFuelFilter)
    const litrosPorDiaSem = new Map<string, number>()
    for (const r of srcSem) {
      if (!r.data) continue
      litrosPorDiaSem.set(r.data, (litrosPorDiaSem.get(r.data) ?? 0) + r.litros)
    }

    const days: DayLine[] = Array.from(byDay.entries())
      .map(([data, v]) => {
        const litrosSemanaAnterior = litrosPorDiaSem.get(addDays(data, -7))
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
          acrescimos: v.totals.acrescimos,
          descontos: v.totals.descontos,
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
    // Total = litros do período vs litros da semana anterior (mesma metodologia
    // da tabela por combustível), não a média das variações diárias.
    const variacaoTotal = (() => {
      const semTotal = Array.from(litrosPorDiaSem.values()).reduce((s, v) => s + v, 0)
      return semTotal > 0 ? ((total.litros - semTotal) / semTotal) * 100 : null
    })()
    return { days, total, variacaoTotal }
  }, [vendaRows, rowsSemanaAnt, diaFuelFilter])

  /* ─── Tabela dia a dia paginada — 15 dias por página, mais recente primeiro. ─── */
  const DIAS_POR_PAGINA = 15
  const diasOrdenados = useMemo(
    () => [...detalheDiaADia.days].sort((a, b) => b.data.localeCompare(a.data)),
    [detalheDiaADia.days],
  )
  // Série ascendente (data → litros) pro gráfico "Litros vendidos por dia" que
  // acompanha a tabela. Respeita o filtro de combustível da aba.
  const diaSerie = useMemo(
    () => [...detalheDiaADia.days]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((d) => ({ data: d.data, litros: d.litros, lbPorLitro: d.litros > 0 ? d.lucroBruto / d.litros : 0 })),
    [detalheDiaADia.days],
  )
  const diaPageCount = Math.max(1, Math.ceil(diasOrdenados.length / DIAS_POR_PAGINA))
  const diaPageSafe = Math.min(diaPage, diaPageCount - 1)
  const diasPagina = useMemo(
    () => diasOrdenados.slice(diaPageSafe * DIAS_POR_PAGINA, diaPageSafe * DIAS_POR_PAGINA + DIAS_POR_PAGINA),
    [diasOrdenados, diaPageSafe],
  )

  /* ─── Análise SEMANAL ───
   * Dois charts/tabelas:
   * 1) Litros vendidos por dia ao longo do período (linha) — filtrável por combustível
   * 2) Média de venda em litros por dia da semana × combustível (heatmap)
   *
   * Denominador da média = nº de dias distintos no dataset que caíram naquele
   * dia da semana (assim Segunda divide pelo nº de segundas do período).
   */
  const fuelOptions = useMemo(() => {
    const set = new Set(vendaRows.map((r) => r.combustivelNome).filter(Boolean))
    return ['Todos', ...Array.from(set).sort()]
  }, [vendaRows])

  const semanalDaily = useMemo(() => {
    const byDate = new Map<string, { litros: number; lucroBruto: number }>()
    for (const r of vendaRows) {
      if (semanalFuelFilter !== 'Todos' && r.combustivelNome !== semanalFuelFilter) continue
      const date = r.data
      if (!date) continue
      const e = byDate.get(date) ?? { litros: 0, lucroBruto: 0 }
      e.litros += r.litros
      e.lucroBruto += r.lucroBruto
      byDate.set(date, e)
    }
    return Array.from(byDate.entries())
      .map(([data, v]) => ({ data, dataFmt: formatDate(data), litros: v.litros, lbPorLitro: v.litros > 0 ? v.lucroBruto / v.litros : 0 }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [vendaRows, semanalFuelFilter])

  const semanalMatrix = useMemo(() => {
    // ordem segunda..domingo (JS getDay: 0=dom..6=sáb)
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]
    const dayLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

    // datas distintas por dia da semana
    const datesByDow = new Map<number, Set<string>>()
    // soma de litros por fuel × dia-da-semana
    const fuelDowSum = new Map<string, Map<number, number>>()

    for (const r of vendaRows) {
      const date = r.data
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
  }, [vendaRows])

  /* ─── Dados pra charts mensais (aba "Últimos 12 meses") ─── */
  // Opções do filtro por combustível da aba "Últimos 12 meses" (vem do cache
  // por produto). Vazio = ainda não há quebra por produto apurada.
  const mesesFuelOptions = useMemo(
    () => ['Todos', ...lbLitroData.monthlyFuels],
    [lbLitroData.monthlyFuels],
  )

  const monthlyChartData = useMemo(() => {
    const src = mesesFuelFilter === 'Todos'
      ? lbLitroData.monthly
      : (lbLitroData.monthlyByFuel[mesesFuelFilter] ?? [])

    // O gráfico de 12 meses vem do cache (apuracao_*), que pode divergir dos
    // cartões (live) no mês selecionado — custo/faturamento calculados em momentos
    // diferentes. Quando o período é UM ÚNICO mês, sobrepõe o ponto desse mês com
    // os valores LIVE dos cartões (fonte autoritativa), pra o último ponto do
    // gráfico bater exatamente com os KPIs do topo. Histórico fica do cache.
    const shiftMonth = (yyyymm: string, n: number): string => {
      const [y, mo] = yyyymm.split('-').map(Number)
      const d = new Date(y, mo - 1 - n, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    const selMonth = (dataFinal ?? '').slice(0, 7)
    const singleMonth = !!dataInicial && !!dataFinal && dataInicial.slice(0, 7) === selMonth
    const liveSel = mesesFuelFilter === 'Todos'
      ? { litros: vendaKpis.litros, faturamento: vendaKpis.faturamento, lucroBruto: vendaKpis.lucroBruto, margemPct: vendaKpis.margemPct, lbPorLitro: vendaKpis.lbPorLitro }
      : (() => {
          const f = fuelTypeData.find((x) => x.nome === mesesFuelFilter)
          return f ? { litros: f.litros, faturamento: f.faturamento, lucroBruto: f.lucroBruto, margemPct: f.margem, lbPorLitro: f.lbPorLitro } : null
        })()
    const overlay = singleMonth && liveSel && liveSel.litros > 0 ? liveSel : null

    // Mês de comparação (mês/ano anterior conforme o toggle) — sobrepõe com o
    // valor LIVE do card "mês anterior" (vendaCmp). Só no "Todos" (vendaCmp é
    // agregado de todos os combustíveis, não tem quebra por produto).
    const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
    const cmpMonth = singleMonth ? shiftMonth(selMonth, cmpOffset) : ''
    const overlayCmp = singleMonth && mesesFuelFilter === 'Todos' && vendaCmp.litros > 0
      ? { litros: vendaCmp.litros, faturamento: vendaCmp.faturamento, lucroBruto: vendaCmp.lucroBruto, margemPct: vendaCmp.margemPct, lbPorLitro: vendaCmp.litros > 0 ? vendaCmp.lucroBruto / vendaCmp.litros : 0 }
      : null

    const mapped = src.map((m) => {
      const ov = overlay && m.mes === selMonth ? overlay
        : overlayCmp && m.mes === cmpMonth ? overlayCmp
        : null
      return {
        mes: formatMonth(m.mes),
        litros: ov ? ov.litros : m.litros,
        lbPorLitro: ov ? ov.lbPorLitro : m.lbPorLitro,
        faturamento: ov ? ov.faturamento : m.faturamento,
        lucroBruto: ov ? ov.lucroBruto : m.lucroBruto,
        margemPct: ov ? ov.margemPct : m.margemPct,
        isCurrentMonth: m.isCurrentMonth,
        semCusto: ov ? false : m.semCusto,
      }
    })

    // Mês selecionado ainda não está no cache → acrescenta o ponto live no fim.
    if (overlay && !src.some((m) => m.mes === selMonth)) {
      mapped.push({
        mes: formatMonth(selMonth),
        litros: overlay.litros,
        lbPorLitro: overlay.lbPorLitro,
        faturamento: overlay.faturamento,
        lucroBruto: overlay.lucroBruto,
        margemPct: overlay.margemPct,
        isCurrentMonth: false,
        semCusto: false,
      })
    }
    return mapped
  }, [lbLitroData.monthly, lbLitroData.monthlyByFuel, mesesFuelFilter, dataInicial, dataFinal, vendaKpis, fuelTypeData, vendaCmp, comparisonMode])

  /** Meses sem custo apurado — L.B./margem não plotáveis (gap no gráfico). */
  const mesesSemCusto = useMemo(
    () => monthlyChartData.filter((m) => m.semCusto).map((m) => m.mes),
    [monthlyChartData],
  )

  /* ─── Projeção EXECUTIVA (faturamento + lucro) ── projecaoAvancada sobre a
   * série diária de faturamento (tendência + sazonalidade + cenários +
   * confiabilidade); o lucro projetado cresce proporcional ao faturamento. */
  const projecaoCombustivel = useMemo(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    // Projeta SEMPRE até o fim do mês do período (independe do escopo
    // Apurado/Em andamento/Completo). O dia corrente entra como faltante.
    const [yy, mm] = (dataInicial || todayISO).split('-').map(Number)
    const lastDay = new Date(yy, mm, 0).getDate()
    const monthEnd = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const fat = projecaoAvancada({
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.faturamento })),
      today: todayISO,
      dataFinal: monthEnd,
    })
    const lucro = projecaoAvancada({
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.lucroBruto })),
      today: todayISO,
      dataFinal: monthEnd,
    })
    const litros = projecaoAvancada({
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.litros })),
      today: todayISO,
      dataFinal: monthEnd,
    })
    return {
      fat,
      projetadoLucro: lucro.esperado,
      projetadoLitros: litros.esperado,
      projetadoMargem: fat.esperado > 0 ? (lucro.esperado / fat.esperado) * 100 : 0,
      projetadoLBLitro: litros.esperado > 0 ? lucro.esperado / litros.esperado : 0,
      dataFinalProjecao: monthEnd,
    }
  }, [dailyData, dataInicial])

  /* ─── Projeção por combustível — TODAS as métricas (litros, lucro, margem,
   * L.B./litro) pro detalhe "Ver detalhes" dos KPIs. Projeta cada série diária
   * por combustível até o fim do mês (mesma engine do card executivo). */
  interface ProjFuelDetalhe { litros: number; lucro: number; fat: number; margem: number; lbLitro: number }
  const projDetalhePorFuel = useMemo<Map<string, ProjFuelDetalhe>>(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const [yy, mm] = (dataInicial || todayISO).split('-').map(Number)
    const lastDay = new Date(yy, mm, 0).getDate()
    const monthEnd = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const litrosByFuel = new Map<string, Map<string, number>>()
    const fatByFuel = new Map<string, Map<string, number>>()
    const lucroByFuel = new Map<string, Map<string, number>>()
    const add = (m: Map<string, Map<string, number>>, fuel: string, day: string, v: number) => {
      const s = m.get(fuel) ?? new Map<string, number>()
      s.set(day, (s.get(day) ?? 0) + v)
      m.set(fuel, s)
    }
    for (const r of vendaRows) {
      const day = r.data
      if (!day || !r.combustivelNome) continue
      add(litrosByFuel, r.combustivelNome, day, r.litros)
      add(fatByFuel, r.combustivelNome, day, r.faturamento)
      add(lucroByFuel, r.combustivelNome, day, r.lucroBruto)
    }
    const proj = (s?: Map<string, number>) =>
      projecaoAvancada({
        dailySeries: Array.from((s ?? new Map<string, number>()).entries()).map(([data, value]) => ({ data, value })),
        today: todayISO,
        dataFinal: monthEnd,
      }).esperado

    const out = new Map<string, ProjFuelDetalhe>()
    for (const f of fuelTypeData) {
      const litros = proj(litrosByFuel.get(f.nome))
      const fat = proj(fatByFuel.get(f.nome))
      const lucro = proj(lucroByFuel.get(f.nome))
      out.set(f.nome, {
        litros,
        lucro,
        fat,
        margem: fat > 0 ? (lucro / fat) * 100 : 0,
        lbLitro: litros > 0 ? lucro / litros : 0,
      })
    }
    return out
  }, [vendaRows, fuelTypeData, dataInicial])

  /* Renderiza a lista de projeção por combustível pro card (formatador por métrica). */
  const renderProjFuelList = (fmt: (d: ProjFuelDetalhe) => string) => (
    <div className="space-y-1 text-[10px] tabular-nums">
      {fuelTypeData.map((f) => {
        const d = projDetalhePorFuel.get(f.nome)
        if (!d) return null
        return (
          <div key={f.nome} className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span className={cn('h-2 w-2 shrink-0 rounded-sm', fuelColor(f.nome))} />
              <span className="truncate">{f.nome}</span>
            </span>
            <span className="shrink-0 font-semibold text-indigo-600 dark:text-indigo-400">{fmt(d)}</span>
          </div>
        )
      })}
    </div>
  )

  /* ─── Máximos por coluna (data bars) ─── */
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
    // Só combustíveis COM custo apurado — sem custo o L.B./litro = preço cheio
    // (margem ~100%) e poluiria o "Maior".
    const comCusto = fuelTypeData.filter((f) => f.custo > 0)
    if (comCusto.length < 2) return null
    const sorted = [...comCusto].sort((a, b) => b.lbPorLitro - a.lbPorLitro)
    return { maior: sorted[0], menor: sorted[sorted.length - 1] }
  }, [fuelTypeData])

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6'}>
      {!embedded && (
        <>
          <PageHeaderTitle placement="header">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
              <Fuel className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
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

          <PageHeaderTitle>
            <VendasNav />
          </PageHeaderTitle>
        </>
      )}

      {(
        <>
          {/* Selo de saúde fiscal (ao vivo, por posto): colapsado mostra se todo
              o movimento de combustível virou documento fiscal; abre só com gap. */}
          <MovimentoFiscalValidacao />

          {/* KPIs principais — 4 cards + Projeção (5º) ocupando a largura
              toda. Em mobile/tablet empilha em 2 ou 3 cols. `items-stretch`
              (default) iguala a altura dos 5 cards. */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {/* Os 4 KPIs num sub-grid próprio: esticam entre si (altura igual)
               e o sub-grid estica até a altura da coluna da projeção. A chave
               abraça SÓ os 4 KPIs de realizado — a Projeção (5ª col) fica fora. */}
            <div className="lg:col-span-4">
            <RealizadoChave />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Litros Vendidos"
              help="Volume total de combustível vendido no período, em litros. Base fiscal: itens de venda autorizados. Clique para a conferência físico × fiscal (perda/sobra)."
              value={showSkeleton ? '—' : formatLiters(vendaKpis.litros)}
              onClick={() => setLitrosModalOpen(true)}
              Icon={Droplets}
              iconBg="bg-cyan-100 dark:bg-cyan-900/30"
              iconColor="text-cyan-600 dark:text-cyan-400"
              cardBg="bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900"
              loading={showSkeleton}
              current={vendaKpis.litros}
              previous={vendaCmp.litros > 0 ? vendaCmp.litros : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoCombustivel.fat.diasRestantes > 0 && !showSkeleton ? formatLiters(projecaoCombustivel.projetadoLitros) : undefined}
              mostrarProjDetalhe={projDetalheAberto && projecaoCombustivel.fat.diasRestantes > 0}
              projDetalhe={renderProjFuelList((d) => formatLiters(d.litros))}
              extra={
                vendaCmp.litros > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatLiters(vendaCmp.litros)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Lucro bruto"
              help="Lucro bruto do período: faturamento líquido − custo (CMV) dos combustíveis."
              value={showSkeleton ? '—' : formatCurrencyInt(vendaKpis.lucroBruto)}
              Icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={showSkeleton}
              current={vendaKpis.lucroBruto}
              previous={vendaCmp.lucroBruto > 0 ? vendaCmp.lucroBruto : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoCombustivel.fat.diasRestantes > 0 && !showSkeleton ? formatCurrencyInt(projecaoCombustivel.projetadoLucro) : undefined}
              mostrarProjDetalhe={projDetalheAberto && projecaoCombustivel.fat.diasRestantes > 0}
              projDetalhe={renderProjFuelList((d) => formatCurrencyInt(d.lucro))}
              extra={
                !showSkeleton && vendaCmp.lucroBruto > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrencyInt(vendaCmp.lucroBruto)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Margem"
              help="Margem bruta: (lucro bruto ÷ faturamento líquido) × 100."
              value={showSkeleton ? '—' : `${margemPctGlobal.toFixed(2).replace('.', ',')}%`}
              Icon={PieChart}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              cardBg="bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900"
              loading={showSkeleton}
              current={margemPctGlobal}
              previous={vendaCmp.margemPct > 0 ? vendaCmp.margemPct : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoCombustivel.fat.diasRestantes > 0 && !showSkeleton ? `${projecaoCombustivel.projetadoMargem.toFixed(2).replace('.', ',')}%` : undefined}
              mostrarProjDetalhe={projDetalheAberto && projecaoCombustivel.fat.diasRestantes > 0}
              projDetalhe={renderProjFuelList((d) => `${d.margem.toFixed(2).replace('.', ',')}%`)}
              extra={
                !showSkeleton && vendaCmp.margemPct > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {`${vendaCmp.margemPct.toFixed(2).replace('.', ',')}%`}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="L.B./Litro"
              help="Lucro bruto por litro vendido: lucro bruto ÷ litros."
              value={showSkeleton ? '—' : formatCurrency(vendaKpis.lbPorLitro)}
              hint="Lucro bruto por litro"
              Icon={TrendingUp}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={showSkeleton}
              current={vendaKpis.lbPorLitro}
              previous={vendaCmp.litros > 0 ? vendaCmp.lucroBruto / vendaCmp.litros : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoCombustivel.fat.diasRestantes > 0 && !showSkeleton ? formatCurrency(projecaoCombustivel.projetadoLBLitro) : undefined}
              mostrarProjDetalhe={projDetalheAberto && projecaoCombustivel.fat.diasRestantes > 0}
              projDetalhe={renderProjFuelList((d) => formatCurrency(d.lbLitro))}
              extra={
                (lbRanking || vendaCmp.litros > 0) ? (
                  <div className="space-y-1 text-[10px] tabular-nums">
                    {vendaCmp.litros > 0 && (
                      <div className="flex items-center justify-between gap-2 text-gray-500 dark:text-gray-400">
                        <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {formatCurrency(vendaCmp.litros > 0 ? vendaCmp.lucroBruto / vendaCmp.litros : 0)}
                        </span>
                      </div>
                    )}
                    {lbRanking && (
                      <>
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
                      </>
                    )}
                  </div>
                ) : null
              }
            />
            </div>
            </div>
            <ProjecaoExecutiva
              fat={projecaoCombustivel.fat}
              projetadoLucro={projecaoCombustivel.projetadoLucro}
              dataFinal={projecaoCombustivel.dataFinalProjecao}
              expanded={projDetalheAberto}
              onToggleExpanded={() => setProjDetalheAberto((v) => !v)}
              loading={isLoadingValor}
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
                {/* Filtro de combustível da aba ativa — ao lado das abas (padrão).
                    Aba "por combustível" não tem filtro; "12 meses" só quando há
                    quebra por combustível. */}
                {(() => {
                  const cfg = detalheTab === 'dia'
                    ? { options: fuelOptions, value: diaFuelFilter, onChange: setDiaFuelFilter }
                    : detalheTab === 'semana'
                      ? { options: fuelOptions, value: semanalFuelFilter, onChange: setSemanalFuelFilter }
                      : detalheTab === 'meses' && mesesFuelOptions.length > 1
                        ? { options: mesesFuelOptions, value: mesesFuelFilter, onChange: setMesesFuelFilter }
                        : null
                  if (!cfg) return null
                  return (
                    <>
                      <FuelSelect options={cfg.options} value={cfg.value} onChange={cfg.onChange} />
                      <span className="mx-1 hidden h-5 w-px bg-gray-200 dark:bg-gray-700 sm:block" />
                    </>
                  )
                })()}
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
            {(isLoadingValor || isLoadingAnalytics) ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : (
              <>
                {/* ── Tab: Realizado dia a dia ── */}
                {detalheTab === 'dia' && (
                  <>
                    {diasOrdenados.length === 0 ? (
                      <div className="px-5 py-12 text-center text-sm text-gray-400">
                        Sem vendas no período.
                      </div>
                    ) : (
                    <>
                    {/* Gráfico "Litros vendidos por dia" acompanhando a tabela (≥ 2 dias). */}
                    {diaSerie.length >= 2 && (
                      <div className="px-4 pb-1 pt-4">
                        <AnaliseSemanalLineCard data={diaSerie} />
                      </div>
                    )}
                    <TablePager
                      page={diaPageSafe}
                      pageCount={diaPageCount}
                      onPrev={() => setDiaPage((p) => Math.max(0, p - 1))}
                      onNext={() => setDiaPage((p) => Math.min(diaPageCount - 1, p + 1))}
                      info={`${diasOrdenados.length} dias`}
                    />
                    <div className={cn('overflow-x-auto', diaPageCount <= 1 && 'pt-3')}>
                      <table className="w-full text-sm">
                        {/* Fundo levíssimo, uma cor por grupo de coluna. */}
                        <colgroup>
                          <col />
                          <col />
                          <col className={GROUP_TINT.operacao} />
                          <col className={GROUP_TINT.comparativo} />
                          <col span={4} className={GROUP_TINT.financeiro} />
                          <col span={3} className={GROUP_TINT.eficiencia} />
                        </colgroup>
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th colSpan={2} className="px-3 py-1.5" />
                            <GroupTh first label="Operação" colSpan={1} />
                            <GroupTh label="Comparativo" colSpan={1} />
                            <GroupTh label="Financeiro" colSpan={4} />
                            <GroupTh label="Eficiência" colSpan={3} />
                          </tr>
                          <tr>
                            <HeaderHint align="left" label="Data" help="Dia do movimento (data fiscal)." />
                            <HeaderHint align="left" label="Dia da semana" help="Dia da semana correspondente." />
                            <HeaderHint label="Litros" help="Litros vendidos no dia (base fiscal)." />
                            <HeaderHint groupStart label="Var. semanal" help="Variação % de litros vs o mesmo dia 7 dias antes." />
                            <HeaderHint groupStart label="Faturamento" help="Faturamento líquido = Bruto + Acréscimo − Desconto. Bruto = preço de bomba × litros." />
                            <HeaderHint label="Lucro bruto" help="Faturamento líquido − custo (CMV) do dia." />
                            <HeaderHint label="Acrés./Desc." help="Acréscimos − descontos do dia (líquido do ajuste). Valor negativo = desconto predominou." />
                            <HeaderHint label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
                            <HeaderHint groupStart label="Preço venda" help="Preço médio de venda por litro: faturamento ÷ litros." />
                            <HeaderHint label="Preço custo" help="Custo médio de aquisição por litro: custo ÷ litros." />
                            <HeaderHint label="L.B. litro" help="Lucro bruto por litro: preço venda − preço custo (R$/L)." />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {diasPagina.map((d) => {
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
                                  <BarCell value={d.litros} max={colMax.litros} formatted={formatNumber(Math.round(d.litros))} color="blue" align="near" />
                                </td>
                                <td className="border-l border-gray-200 px-3 py-2 text-right tabular-nums dark:border-gray-700">
                                  {d.variacaoSemanal === null ? (
                                    <span className="text-gray-400">—</span>
                                  ) : (
                                    <span className={cn('inline-flex items-center justify-end gap-0.5 font-semibold', variationColor(d.variacaoSemanal))}>
                                      {formatPct(d.variacaoSemanal)}
                                      {d.variacaoSemanal > 0 ? <TrendingUp className="h-3 w-3" /> : d.variacaoSemanal < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                    </span>
                                  )}
                                </td>
                                <td className="border-l border-gray-200 px-2 py-1 dark:border-gray-700">
                                  <BarCell value={d.faturamento} max={colMax.faturamento} formatted={formatCurrencyInt(d.faturamento)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={d.lucroBruto} max={colMax.lucroBruto} formatted={formatCurrencyInt(d.lucroBruto)} color="green" align="near" />
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                  {formatCurrencyInt(d.acrescimos - d.descontos)}
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={margemPct} max={colMax.margem} formatted={`${margemPct.toFixed(2).replace('.', ',')}%`} color="slate" align="near" />
                                </td>
                                <td className="border-l border-gray-200 px-3 py-2 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">
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
                          {/* Subtotal da PÁGINA visível + Total do PERÍODO (discreto) */}
                          {diasPagina.length > 0 && (() => {
                            const sub = diasPagina.reduce(
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
                            const subMargem = sub.faturamento > 0 ? (sub.lucroBruto / sub.faturamento) * 100 : 0
                            const tot = detalheDiaADia.total
                            const totMargem = tot.faturamento > 0 ? (tot.lucroBruto / tot.faturamento) * 100 : 0
                            return (
                              <>
                                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                                  <td className="px-3 py-2.5">Nesta página</td>
                                  <td className="px-3 py-2.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{diasPagina.length} dias</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(Math.round(sub.litros))}</td>
                                  <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums text-gray-400 dark:border-gray-700">—</td>
                                  <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(sub.faturamento)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyInt(sub.lucroBruto)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyInt(sub.acrescimos - sub.descontos)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{sub.faturamento > 0 ? `${subMargem.toFixed(2).replace('.', ',')}%` : '—'}</td>
                                  <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">{sub.litros > 0 ? formatCurrency(sub.faturamento / sub.litros) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{sub.litros > 0 ? formatCurrency(sub.custo / sub.litros) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{sub.litros > 0 ? formatCurrency(sub.lucroBruto / sub.litros) : '—'}</td>
                                </tr>
                                <tr className="bg-gray-50/60 text-xs text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
                                  <td className="px-3 py-1.5 font-medium">Período</td>
                                  <td className="px-3 py-1.5 text-[11px]">{detalheDiaADia.days.length} dias</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(Math.round(tot.litros))}</td>
                                  <td className="border-l border-gray-200 px-3 py-1.5 text-right tabular-nums dark:border-gray-700">
                                    {detalheDiaADia.variacaoTotal === null ? '—' : <span className={variationColor(detalheDiaADia.variacaoTotal)}>{formatPct(detalheDiaADia.variacaoTotal)}</span>}
                                  </td>
                                  <td className="border-l border-gray-200 px-3 py-1.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(tot.faturamento)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrencyInt(tot.lucroBruto)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrencyInt(tot.acrescimos - tot.descontos)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{tot.faturamento > 0 ? `${totMargem.toFixed(2).replace('.', ',')}%` : '—'}</td>
                                  <td className="border-l border-gray-200 px-3 py-1.5 text-right tabular-nums dark:border-gray-700">{tot.litros > 0 ? formatCurrency(tot.faturamento / tot.litros) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{tot.litros > 0 ? formatCurrency(tot.custo / tot.litros) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{tot.litros > 0 ? formatCurrency(tot.lucroBruto / tot.litros) : '—'}</td>
                                </tr>
                              </>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                    </>
                    )}
                  </>
                )}

                {/* ── Tab: Realizado - por combustível ── */}
                {detalheTab === 'combustivel' && (
                  mix.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">
                      Sem vendas no período.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {!single1Posto && (
                        <p className="px-5 pt-3 text-[11px] text-gray-400 dark:text-gray-500">
                          Visão consolidada da rede. Selecione 1 posto para abrir o ritmo de bomba/frentista por combustível.
                        </p>
                      )}
                      <table className="w-full text-sm">
                        {/* Fundo levíssimo, uma cor por grupo de coluna. */}
                        <colgroup>
                          <col />
                          <col className={GROUP_TINT.operacao} />
                          <col className={GROUP_TINT.comparativo} />
                          <col span={5} className={GROUP_TINT.financeiro} />
                          <col span={3} className={GROUP_TINT.eficiencia} />
                        </colgroup>
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-1.5" />
                            <GroupTh first label="Operação" colSpan={1} />
                            <GroupTh label="Comparativo" colSpan={1} />
                            <GroupTh label="Financeiro" colSpan={5} />
                            <GroupTh label="Eficiência" colSpan={3} />
                          </tr>
                          <tr>
                            <HeaderHint align="left" label="Combustível" help="Tipo de combustível vendido no período." />
                            <HeaderHint label="Litros" help="Volume total vendido no período (L)." />
                            <HeaderHint groupStart label="Variação semanal" help="Variação % de litros vs a semana anterior (mesmo intervalo, 7 dias antes)." />
                            <HeaderHint groupStart label="Faturamento" help="Faturamento líquido = Bruto + Acréscimo − Desconto. Bruto = preço de bomba × litros." />
                            <HeaderHint label="Lucro bruto" help="Lucro bruto total: faturamento − custo (R$)." />
                            <HeaderHint label="Acréscimos" help="Acréscimos aplicados nas vendas desse combustível (R$)." />
                            <HeaderHint label="Descontos" help="Descontos concedidos nas vendas desse combustível (R$)." />
                            <HeaderHint label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
                            <HeaderHint groupStart label="Preço venda" help="Preço médio de venda por litro: faturamento ÷ litros." />
                            <HeaderHint label="Preço custo" help="Custo médio de aquisição por litro: custo ÷ litros." />
                            <HeaderHint label="L.B. litro" help="Lucro bruto por litro: preço venda − preço custo (R$/L)." />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {(() => {
                            // Máximos por coluna pra escalar as barras do tab "Por combustível"
                            const maxLitros = Math.max(...mix.map((f) => f.litros), 0)
                            const maxFat = Math.max(...mix.map((f) => f.faturamento), 0)
                            const maxLucroBruto = Math.max(...mix.map((f) => f.lucroBruto), 0)
                            const maxLb = Math.max(...mix.map((f) => f.lbPorLitro), 0)
                            const maxMargem = Math.max(...mix.map((f) => f.margem), 0)
                            // Totais agregados — alimentam a linha "Total" no rodapé
                            const totLitros = mix.reduce((s, f) => s + f.litros, 0)
                            const totFat = mix.reduce((s, f) => s + f.faturamento, 0)
                            const totLucroBruto = mix.reduce((s, f) => s + f.lucroBruto, 0)
                            const totCusto = mix.reduce((s, f) => s + f.custo, 0)
                            const totDesc = mix.reduce((s, f) => s + f.desconto, 0)
                            const totAcre = mix.reduce((s, f) => s + f.acrescimo, 0)
                            const totMargemPct = totFat > 0 ? (totLucroBruto / totFat) * 100 : 0
                            const totPrecoMed = totLitros > 0 ? totFat / totLitros : 0
                            const totCustoMed = totLitros > 0 ? totCusto / totLitros : 0
                            const totLbLitro = totLitros > 0 ? totLucroBruto / totLitros : 0
                            const totVariacao = semanaAntLitros > 0 ? ((totLitros - semanaAntLitros) / semanaAntLitros) * 100 : null
                            return (
                              <>
                                {mix.map((f) => (
                                  <tr
                                    key={f.produtoCodigo}
                                    className={cn(
                                      single1Posto && 'cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/30',
                                    )}
                                    onClick={single1Posto ? () => setSelectedFuel(f) : undefined}
                                  >
                                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                      <span className="flex items-center gap-2">
                                        <span className={cn('h-2 w-2 rounded-full', fuelColor(f.nome))} aria-hidden="true" />
                                        <span className="truncate underline-offset-4 hover:underline" title={f.nome}>{f.nome}</span>
                                      </span>
                                    </td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.litros} max={maxLitros} formatted={formatNumber(Math.round(f.litros))} color="blue" align="near" />
                                    </td>
                                    <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">
                                      {f.variacao === null ? (
                                        <span className="text-gray-400">—</span>
                                      ) : (
                                        <span className={cn('inline-flex items-center justify-end gap-0.5 font-semibold', variationColor(f.variacao))}>
                                          {formatPct(f.variacao, 2)}
                                          {f.variacao > 0 ? <TrendingUp className="h-3 w-3" /> : f.variacao < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                        </span>
                                      )}
                                    </td>
                                    <td className="border-l border-gray-200 px-2 py-1 dark:border-gray-700">
                                      <BarCell value={f.faturamento} max={maxFat} formatted={formatCurrencyInt(f.faturamento)} color="green" align="near" />
                                    </td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.lucroBruto} max={maxLucroBruto} formatted={formatCurrencyInt(f.lucroBruto)} color="green" align="near" />
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(f.acrescimo)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(f.desconto)}</td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.margem} max={maxMargem} formatted={`${f.margem.toFixed(2).replace('.', ',')}%`} color="slate" align="near" />
                                    </td>
                                    <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">{formatCurrency(f.precoMedioVenda)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.precoCustoMedio)}</td>
                                    <td className="px-2 py-1">
                                      <BarCell value={f.lbPorLitro} max={maxLb} formatted={formatCurrency(f.lbPorLitro)} color="amber" align="near" />
                                    </td>
                                  </tr>
                                ))}
                                {/* Linha Total */}
                                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                                  <td className="px-4 py-2.5">Total</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(Math.round(totLitros))}</td>
                                  <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">
                                    {totVariacao === null ? '—' : <span className={variationColor(totVariacao)}>{formatPct(totVariacao)}</span>}
                                  </td>
                                  <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(totFat)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(totLucroBruto)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(totAcre)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(totDesc)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{totMargemPct.toFixed(2).replace('.', ',')}%</td>
                                  <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrency(totPrecoMed)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totCustoMed)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totLbLitro)}</td>
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
                    <div className="p-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* Chart 1: Litros (bar) + L.B./Litro (line) */}
                      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Litros vendidos e L.B./Litro por mês
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={monthlyChartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(Math.round(v))} />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 10, fill: '#9ca3af' }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => formatCurrency(v)}
                            />
                            <Tooltip
                              formatter={((value: number | null, name: string) =>
                                value == null ? ['—', name]
                                  : name === 'L.B./Litro' ? [formatCurrency(value), name]
                                  : [formatNumber(Math.round(value)), name]
                              ) as never}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                            <Bar yAxisId="left" dataKey="litros" name="Litros vendidos" fill="#1e3a5f" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="litros" position="top" formatter={((v: number) => formatNumber(Math.round(v))) as never} style={{ fontSize: 10, fill: '#374151' }} />
                            </Bar>
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="lbPorLitro"
                              name="L.B./Litro"
                              stroke="#d97706"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#d97706', stroke: '#92400e', strokeWidth: 1 }}
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
                        {mesesSemCusto.length > 0 && (
                          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                            Sem custo apurado em {mesesSemCusto.join(', ')} — L.B./margem omitidos nesses meses.
                          </p>
                        )}
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={monthlyChartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyInt(v)} />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 10, fill: '#9ca3af' }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => `${v.toFixed(0)}%`}
                            />
                            <Tooltip
                              formatter={((value: number | null, name: string) =>
                                value == null ? ['—', name]
                                  : name === 'Margem' ? [`${value.toFixed(2).replace('.', ',')}%`, name]
                                  : [formatCurrencyInt(value), name]
                              ) as never}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                            <Bar yAxisId="left" dataKey="lucroBruto" name="Lucro bruto" fill="#1e3a5f" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="lucroBruto" position="top" formatter={((v: number | null) => (v == null ? '' : formatCurrencyInt(v))) as never} style={{ fontSize: 10, fill: '#374151' }} />
                            </Bar>
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="margemPct"
                              name="Margem"
                              stroke="#d97706"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#d97706', stroke: '#92400e', strokeWidth: 1 }}
                              activeDot={{ r: 5 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
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
                    <div className="grid grid-cols-1 items-start gap-4 p-4 lg:grid-cols-[1fr_1.12fr]">
                      {/* Esquerda: gráfico de linha premium (SVG à mão) */}
                      <AnaliseSemanalLineCard data={semanalDaily} />

                      {/* Direita: heatmap "Média por dia da semana × combustível" */}
                      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              Média de venda em litros · por dia da semana
                            </h3>
                            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                              Intensidade da cor = volume relativo dentro do combustível
                            </p>
                          </div>
                          {/* Legenda de intensidade (Baixo → Alto) */}
                          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Baixo</span>
                            <span className="h-2 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(0.05)}, ${heatColor(1)})` }} />
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Alto</span>
                          </div>
                        </div>

                        <div className="mt-3 overflow-x-auto">
                          {(() => {
                            // Melhor/pior dia da semana (pela média total) — realce verde/âmbar.
                            const bestDay = semanalMatrix.colValues.reduce((mi, v, i, a) => (v > a[mi] ? i : mi), 0)
                            const worstDay = semanalMatrix.colValues.reduce((mi, v, i, a) => (v < a[mi] ? i : mi), 0)
                            return (
                          <table className="w-full text-xs">
                            <thead className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              <tr>
                                <th className="pb-2 pr-3 text-left font-semibold">Combustível</th>
                                {DOW_SHORT.map((d, i) => (
                                  <th key={d} className={cn('px-2 pb-2 text-right font-semibold', i === bestDay && 'text-emerald-600 dark:text-emerald-400', i === worstDay && 'text-amber-600 dark:text-amber-500')}>{d}</th>
                                ))}
                                <th className="border-l border-gray-200 px-2 pb-2 text-right font-semibold dark:border-gray-700">Média</th>
                              </tr>
                            </thead>
                            <tbody>
                              {semanalMatrix.rows.map((row, rowIdx) => (
                                <tr key={row.nome}>
                                  <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center gap-1.5">
                                      <span className="truncate" title={row.nome}>{row.nome}</span>
                                      {/* rows vem ordenado por média desc → 1º = líder, último = lanterna. */}
                                      {rowIdx === 0 && (
                                        <span className="inline-flex shrink-0" title="Maior média do período" aria-label="Maior média do período">
                                          <Trophy className="h-3 w-3 text-amber-500" />
                                        </span>
                                      )}
                                      {rowIdx === semanalMatrix.rows.length - 1 && semanalMatrix.rows.length > 1 && (
                                        <span className="inline-flex shrink-0" title="Menor média do período" aria-label="Menor média do período">
                                          <TrendingDown className="h-3 w-3 text-red-500" />
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  {row.values.map((v, i) => {
                                    const t = semanalMatrix.matrixMax > 0 ? v / semanalMatrix.matrixMax : 0
                                    return (
                                      <td key={i} className="p-0.5">
                                        <div
                                          className="rounded-md px-2 py-1.5 text-right font-semibold tabular-nums"
                                          style={{ backgroundColor: heatColor(t), color: t > 0.58 ? '#fff' : '#334155' }}
                                        >
                                          {formatNumber(Math.round(v))}
                                        </div>
                                      </td>
                                    )
                                  })}
                                  <td className="border-l border-gray-200 px-2 py-1.5 text-right font-bold tabular-nums text-[#1e3a5f] dark:border-gray-700 dark:text-gray-100">
                                    {formatNumber(Math.round(row.total))}
                                  </td>
                                </tr>
                              ))}
                              {/* Linha de totais (média por dia da semana) */}
                              <tr className="border-t-2 border-gray-300 font-bold text-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <td className="pt-2.5 pr-3">Total</td>
                                {semanalMatrix.colValues.map((v, i) => (
                                  <td key={i} className={cn('px-2 pt-2.5 text-right tabular-nums', i === bestDay && 'text-emerald-600 dark:text-emerald-400', i === worstDay && 'text-amber-600 dark:text-amber-500')}>
                                    {formatNumber(Math.round(v))}
                                  </td>
                                ))}
                                <td className="border-l border-gray-200 px-2 pt-2.5 text-right tabular-nums text-[#1e3a5f] dark:border-gray-700 dark:text-gray-100">
                                  {formatNumber(Math.round(semanalMatrix.grandTotal))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                            )
                          })()}
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

      <LitrosVendidosModal
        open={litrosModalOpen}
        onClose={() => setLitrosModalOpen(false)}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
      />
    </div>
  )
}

export default ComercialVendasCombustivel
