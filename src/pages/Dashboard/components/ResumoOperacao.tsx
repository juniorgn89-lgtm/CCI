import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { DollarSign, Wallet, Droplets, TrendingUp, Clock, HelpCircle, Network } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatLiters } from '@/lib/formatters'
import { smoothedProjection, movingAverageDailyRate } from '@/lib/projection'
import InstantBadge from '@/components/layout/InstantBadge'
import useResumoOperacaoData from '@/pages/Dashboard/hooks/useResumoOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import NivelTanquesCard from '@/pages/Dashboard/components/NivelTanquesCard'
import { useAuthStore } from '@/store/auth'

/* ── Helpers ─────────────────────────────────────────────── */

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface ProjectionMeta {
  daysTotal: number
  daysElapsed: number
  daysRemaining: number
  isProjectable: boolean
}

const computeProjection = (dataInicial: string, dataFinal: string): ProjectionMeta => {
  if (!dataInicial || !dataFinal) {
    return { daysTotal: 0, daysElapsed: 0, daysRemaining: 0, isProjectable: false }
  }
  const dayMs = 24 * 3600 * 1000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${dataInicial}T00:00:00`)
  const end = new Date(`${dataFinal}T00:00:00`)
  const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1)
  if (today < start) return { daysTotal, daysElapsed: 0, daysRemaining: daysTotal, isProjectable: false }
  if (today > end) return { daysTotal, daysElapsed: daysTotal, daysRemaining: 0, isProjectable: false }
  const daysElapsed = Math.max(1, Math.round((today.getTime() - start.getTime()) / dayMs) + 1)
  const daysRemaining = Math.max(0, Math.round((end.getTime() - today.getTime()) / dayMs))
  const isProjectable = daysRemaining > 0 && daysElapsed > 0
  return { daysTotal, daysElapsed, daysRemaining, isProjectable }
}

/* ── Tooltip ─────────────────────────────────────────────── */

interface DailyPoint {
  data: string
  label: string
  real: number | null
  projetado: number | null
}

interface DailyTooltipProps {
  active?: boolean
  payload?: Array<{ payload: DailyPoint }>
  unit: 'currency' | 'liters'
}

const DailyTooltip = ({ active, payload, unit }: DailyTooltipProps) => {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const value = item.real ?? item.projetado
  if (value == null) return null
  const isProjected = item.real == null && item.projetado != null
  const formatted = unit === 'currency' ? formatCurrencyTooltip(value) : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="font-semibold text-gray-700 dark:text-gray-200">
        {item.data.split('-').reverse().join('/')}
      </p>
      <p className={cn('mt-1', isProjected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100')}>
        {isProjected ? 'Projetado' : 'Realizado'}: {formatted}
      </p>
    </div>
  )
}

/* ── KPI Card with projection ────────────────────────────── */

interface MainKpiCardProps {
  label: string
  realizado: number
  /** Projeção fim do período (extrapola realizado-até-agora). Útil em mês corrente. */
  projetado: number
  /** Projeção baseada nos primeiros 7 dias × diasTotais. Útil em mês fechado pra comparar
   *  o realizado real com o "se mantivesse o ritmo inicial". */
  projetadoFirst7?: number
  isProjectable: boolean
  daysElapsed: number
  daysTotal: number
  daysRemaining: number
  icon: typeof DollarSign
  cardBg: string
  iconBg: string
  iconColor: string
  formatter: (v: number) => string
  /** Linha pequena opcional sob "realizado no período" (ex.: litros + preço médio). */
  submetric?: string
  onClick: () => void
}

const MainKpiCard = ({
  label, realizado, projetado, projetadoFirst7, isProjectable, daysElapsed, daysTotal, daysRemaining,
  icon: Icon, cardBg, iconBg, iconColor, formatter, submetric, onClick,
}: MainKpiCardProps) => {
  const progressPct = projetado > 0 ? Math.min(100, (realizado / projetado) * 100) : 0
  // Para mês fechado: compara o realizado total com o que era projetado pela
  // 1ª semana. Mostra se manteve, superou ou ficou abaixo do ritmo inicial.
  const showFirst7 = !isProjectable && (projetadoFirst7 ?? 0) > 0 && realizado > 0
  const first7Delta = showFirst7
    ? ((realizado - (projetadoFirst7 ?? 0)) / (projetadoFirst7 ?? 1)) * 100
    : 0
  const first7Above = first7Delta >= 0

  // Popover de explicação do "?" — abre no click, fecha no click fora ou Esc.
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!helpOpen) return
    const onClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false)
      }
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-gray-200 p-6 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700',
        cardBg,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatter(realizado)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">realizado no período</p>
          {submetric && (
            <p className="mt-1 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{submetric}</p>
          )}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconBg)}>
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>
      </div>

      {isProjectable && projetado > 0 && (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-800/40 dark:bg-blue-900/20">
            <TrendingUp className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Projeção fim do período
              </p>
              <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">
                {formatter(projetado)}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span className="tabular-nums">{progressPct.toFixed(0)}% atingido</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysElapsed} de {daysTotal} dias · {daysRemaining} restante{daysRemaining === 1 ? '' : 's'}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </>
      )}

      {showFirst7 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-800/40 dark:bg-blue-900/20">
          <TrendingUp className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0 flex-1">
            <div className="relative flex items-center gap-1" ref={helpRef}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Projetado pela 1ª semana
              </p>
              <span
                role="button"
                tabIndex={0}
                aria-label="Como é calculado"
                aria-expanded={helpOpen}
                onClick={(e) => {
                  e.stopPropagation()
                  setHelpOpen((v) => !v)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    e.preventDefault()
                    setHelpOpen((v) => !v)
                  }
                }}
                className={cn(
                  'inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-colors',
                  'text-blue-500/70 hover:bg-blue-100 hover:text-blue-700',
                  'dark:text-blue-400/70 dark:hover:bg-blue-900/40 dark:hover:text-blue-200',
                  helpOpen && 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
                )}
              >
                <HelpCircle className="h-3 w-3" />
              </span>

              {helpOpen && (
                <div
                  role="tooltip"
                  className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-3.5 text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        Projetado pela 1ª semana
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
                        Quanto o período fecharia se a média diária dos 7 primeiros dias se mantivesse até o fim.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto whitespace-nowrap rounded-md bg-gray-50 px-2.5 py-1.5 text-[10.5px] font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    (média dos 7 primeiros dias) × dias totais
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Útil pra ver se o ritmo do início se manteve, melhorou ou caiu até o fechamento.
                  </p>
                </div>
              )}
            </div>
            <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">
              {formatter(projetadoFirst7 ?? 0)}
            </p>
            <p
              className={cn(
                'mt-0.5 text-[11px] font-medium tabular-nums',
                first7Above ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}
            >
              {first7Above ? '↑' : '↓'} {first7Above ? '+' : ''}{first7Delta.toFixed(1)}% {first7Above ? 'acima' : 'abaixo'} do projetado
            </p>
          </div>
        </div>
      )}
    </button>
  )
}

/* ── Main component ──────────────────────────────────────── */

const ResumoOperacao = ({ empresaNome }: { empresaNome: string }) => {
  const navigate = useNavigate()
  const { dataInicial, dataFinal, empresaCodigos, setEmpresas } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const canVerReabastecimento = useAuthStore((s) => s.canVerReabastecimento)
  const {
    faturamentoCombustivel,
    totalLitros,
    totalApurado,
    litrosPorDia,
    faturamentoPorDia,
    apuradoPorDia,
    isLoading,
    isCacheHit,
  } = useResumoOperacaoData()
  const hasData = faturamentoCombustivel > 0 || totalApurado > 0 || totalLitros > 0
  const showSkeleton = useShowSkeleton(isLoading, hasData)

  const projection = useMemo(() => computeProjection(dataInicial, dataFinal), [dataInicial, dataFinal])

  // Período de um único dia (ex.: "Em andamento" = hoje) — os gráficos diários
  // viram um ponto só, então escondemos.
  const isSingleDay = dataInicial === dataFinal

  // Projeção baseada nos 7 primeiros dias do período: extrapola "se mantivesse
  // o ritmo inicial, fecharíamos em X". Usado pra mês fechado (comparar
  // realizado total vs projeção feita lá no começo) ou pra contextualizar
  // o mês corrente.
  const projFromFirst7 = (
    series: { data: string; v: number }[],
    daysTotal: number,
  ): number => {
    if (daysTotal <= 0) return 0
    const sorted = series.slice().sort((a, b) => a.data.localeCompare(b.data))
    const first7 = sorted.slice(0, 7)
    if (first7.length === 0) return 0
    const sum = first7.reduce((s, d) => s + d.v, 0)
    return (sum / first7.length) * daysTotal
  }

  const proj7Faturamento = projFromFirst7(
    faturamentoPorDia.map((d) => ({ data: d.data, v: d.faturamento })),
    projection.daysTotal,
  )
  const proj7Apurado = projFromFirst7(
    apuradoPorDia.map((d) => ({ data: d.data, v: d.apurado })),
    projection.daysTotal,
  )

  /* Séries com projeção pra cada gráfico */
  const apuradoChartData: DailyPoint[] = useMemo(() => {
    if (!apuradoPorDia.length) return []
    const today = ymd(new Date())
    const avg = movingAverageDailyRate(
      apuradoPorDia.map((d) => ({ data: d.data, value: d.apurado })),
      today,
    )
    return apuradoPorDia.map((d) => {
      const isFuture = d.data > today
      const isToday = d.data === today
      return {
        data: d.data,
        label: d.data.split('-').slice(1).reverse().join('/'),
        real: !isFuture ? d.apurado : null,
        projetado: isFuture ? avg : isToday ? d.apurado : null,
      }
    })
  }, [apuradoPorDia])

  const litrosChartData: DailyPoint[] = useMemo(() => {
    if (!litrosPorDia.length) return []
    const today = ymd(new Date())
    const avg = movingAverageDailyRate(
      litrosPorDia.map((d) => ({ data: d.data, value: d.litros })),
      today,
    )
    // Gera todos os dias do período
    const startD = new Date(`${dataInicial}T00:00:00`)
    const endD = new Date(`${dataFinal}T00:00:00`)
    const map = new Map(litrosPorDia.map((d) => [d.data, d.litros]))
    const out: DailyPoint[] = []
    for (const cursor = new Date(startD); cursor <= endD; cursor.setDate(cursor.getDate() + 1)) {
      const ds = ymd(cursor)
      const isFuture = ds > today
      const real = map.get(ds)
      out.push({
        data: ds,
        label: ds.split('-').slice(1).reverse().join('/'),
        real: !isFuture ? (real ?? 0) : null,
        projetado: isFuture ? avg : null,
      })
    }
    return out
  }, [litrosPorDia, dataInicial, dataFinal])

  /* Projetados totais — média móvel dos últimos 7 dias fechados (hoje
     excluído) aplicada aos dias restantes, em vez de extrapolação linear. */
  const todayISO = ymd(new Date())
  const projFaturamento = smoothedProjection({
    realizado: faturamentoCombustivel,
    dailySeries: faturamentoPorDia.map((d) => ({ data: d.data, value: d.faturamento })),
    diasRestantes: projection.daysRemaining,
    today: todayISO,
  }).projetado
  const projApurado = smoothedProjection({
    realizado: totalApurado,
    dailySeries: apuradoPorDia.map((d) => ({ data: d.data, value: d.apurado })),
    diasRestantes: projection.daysRemaining,
    today: todayISO,
  }).projetado
  const projLitros = smoothedProjection({
    realizado: totalLitros,
    dailySeries: litrosPorDia.map((d) => ({ data: d.data, value: d.litros })),
    diasRestantes: projection.daysRemaining,
    today: todayISO,
  }).projetado

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!hasData) return null

  return (
    <div className="space-y-5">
      {/* Título + cache badge → portal pra sub-bar (esquerda).
          Botão "Ver Operação" → portal pra sub-bar (direita). */}
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
                Resumo · {empresaNome}
              </h2>
              {isCacheHit && (
                <InstantBadge title="Combustível do snapshot mensal — carregamento instantâneo" />
              )}
            </div>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Visão consolidada do posto com projeção de fim de período
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <button
          type="button"
          onClick={() => setEmpresas([])}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Network className="h-3.5 w-3.5" />
          Central da Rede
        </button>
      </PageHeaderActions>

      {/* 2 KPIs principais com projeção em destaque */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MainKpiCard
          label="Faturamento Combustível"
          realizado={faturamentoCombustivel}
          projetado={projFaturamento}
          projetadoFirst7={proj7Faturamento}
          isProjectable={projection.isProjectable}
          daysElapsed={projection.daysElapsed}
          daysTotal={projection.daysTotal}
          daysRemaining={projection.daysRemaining}
          icon={DollarSign}
          cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          formatter={formatCurrency}
          submetric={
            totalLitros > 0
              ? `${formatLiters(totalLitros)} vendidos · ${formatCurrency(faturamentoCombustivel / totalLitros)}/L`
              : undefined
          }
          onClick={() => navigate('/operacao/combustivel?tab=caixa')}
        />
        <MainKpiCard
          label="Total Apurado"
          realizado={totalApurado}
          projetado={projApurado}
          projetadoFirst7={proj7Apurado}
          isProjectable={projection.isProjectable}
          daysElapsed={projection.daysElapsed}
          daysTotal={projection.daysTotal}
          daysRemaining={projection.daysRemaining}
          icon={Wallet}
          cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          formatter={formatCurrency}
          onClick={() => navigate('/operacao/combustivel?tab=caixa')}
        />
      </div>

      {/* Gráficos diários — escondidos quando o período é um único dia
          (ex.: "Em andamento" = hoje), em que viram um ponto só. */}
      {!isSingleDay && (
      <>
      {/* Mini-gráfico: Apurado diário com projeção */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Wallet className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Apurado diário
          </h3>
          {projection.isProjectable && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
              Projeção: {formatCurrency(projApurado)}
            </span>
          )}
        </div>
        {apuradoChartData.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={apuradoChartData} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="resumoApuradoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={62} />
              <Tooltip content={<DailyTooltip unit="currency" />} />
              <Area
                type="monotone"
                dataKey="real"
                name="Apurado"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#resumoApuradoFill)"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="projetado"
                name="Projetado"
                stroke="#2563eb"
                strokeOpacity={0.6}
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#resumoApuradoFill)"
                fillOpacity={0.3}
                connectNulls={false}
                isAnimationActive={false}
              />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="2 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mini-gráfico: Litros diário com projeção */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Droplets className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Litros vendidos diários
          </h3>
          {projection.isProjectable && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
              Projeção: {formatLiters(projLitros)}
            </span>
          )}
        </div>
        {litrosChartData.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={litrosChartData} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<DailyTooltip unit="liters" />} />
              <Bar dataKey="real" name="Litros" fill="#2563eb" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
              <Bar
                dataKey="projetado"
                name="Litros (projeção)"
                fill="#2563eb"
                fillOpacity={0.18}
                stroke="#2563eb"
                strokeOpacity={0.4}
                strokeDasharray="3 3"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      </>
      )}

      {/* Nível dos tanques — todos os combustíveis do posto, gated por permissão */}
      {canVerReabastecimento && empresaCodigo != null && (
        <NivelTanquesCard empresaCodigo={empresaCodigo} />
      )}
    </div>
  )
}

export default ResumoOperacao
