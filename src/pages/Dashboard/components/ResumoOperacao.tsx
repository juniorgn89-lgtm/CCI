import { useMemo } from 'react'
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
import { DollarSign, Wallet, Droplets, TrendingUp, ArrowRight, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatLiters } from '@/lib/formatters'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

/* ── Helpers ─────────────────────────────────────────────── */

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface ProjectionMeta {
  daysTotal: number
  daysElapsed: number
  daysRemaining: number
  isProjectable: boolean
  scaleFactor: number
}

const computeProjection = (dataInicial: string, dataFinal: string): ProjectionMeta => {
  if (!dataInicial || !dataFinal) {
    return { daysTotal: 0, daysElapsed: 0, daysRemaining: 0, isProjectable: false, scaleFactor: 1 }
  }
  const dayMs = 24 * 3600 * 1000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${dataInicial}T00:00:00`)
  const end = new Date(`${dataFinal}T00:00:00`)
  const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1)
  if (today < start) return { daysTotal, daysElapsed: 0, daysRemaining: daysTotal, isProjectable: false, scaleFactor: 1 }
  if (today > end) return { daysTotal, daysElapsed: daysTotal, daysRemaining: 0, isProjectable: false, scaleFactor: 1 }
  const daysElapsed = Math.max(1, Math.round((today.getTime() - start.getTime()) / dayMs) + 1)
  const daysRemaining = Math.max(0, Math.round((end.getTime() - today.getTime()) / dayMs))
  const isProjectable = daysRemaining > 0 && daysElapsed > 0
  const scaleFactor = isProjectable ? daysTotal / daysElapsed : 1
  return { daysTotal, daysElapsed, daysRemaining, isProjectable, scaleFactor }
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
  projetado: number
  isProjectable: boolean
  daysElapsed: number
  daysTotal: number
  daysRemaining: number
  icon: typeof DollarSign
  cardBg: string
  iconBg: string
  iconColor: string
  formatter: (v: number) => string
  onClick: () => void
}

const MainKpiCard = ({
  label, realizado, projetado, isProjectable, daysElapsed, daysTotal, daysRemaining,
  icon: Icon, cardBg, iconBg, iconColor, formatter, onClick,
}: MainKpiCardProps) => {
  const progressPct = projetado > 0 ? Math.min(100, (realizado / projetado) * 100) : 0
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
    </button>
  )
}

/* ── Main component ──────────────────────────────────────── */

const ResumoOperacao = ({ empresaNome }: { empresaNome: string }) => {
  const navigate = useNavigate()
  const { dataInicial, dataFinal } = useFilterStore()
  const { kpis, abastecimentoRows, apuradoPorDia, isLoading } = useOperacaoData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  const projection = useMemo(() => computeProjection(dataInicial, dataFinal), [dataInicial, dataFinal])

  /* Litros por dia (a partir dos abastecimentos) */
  const litrosPorDia = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of abastecimentoRows) {
      const day = a.dataHora?.substring(0, 10) ?? ''
      if (!day) continue
      map.set(day, (map.get(day) ?? 0) + a.litros)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, litros]) => ({ data, litros }))
  }, [abastecimentoRows])

  /* Séries com projeção pra cada gráfico */
  const apuradoChartData: DailyPoint[] = useMemo(() => {
    if (!apuradoPorDia.length) return []
    const today = ymd(new Date())
    const past = apuradoPorDia.filter((d) => d.data <= today)
    const last7 = past.slice(-7)
    const avg = last7.length > 0 ? last7.reduce((s, d) => s + d.apurado, 0) / last7.length : 0
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
    const past = litrosPorDia.filter((d) => d.data <= today)
    const last7 = past.slice(-7)
    const avg = last7.length > 0 ? last7.reduce((s, d) => s + d.litros, 0) / last7.length : 0
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

  /* Projetados totais (litros é calculado a partir do scaleFactor) */
  const projFaturamento = kpis ? kpis.faturamentoCombustivel * projection.scaleFactor : 0
  const projApurado = kpis ? kpis.totalApurado * projection.scaleFactor : 0

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

  if (!kpis) return null

  return (
    <div className="space-y-5">
      {/* Header dinâmico */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Resumo · {empresaNome}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visão consolidada do posto com projeção de fim de período
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/operacao')}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Ver Operação completa
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 2 KPIs principais com projeção em destaque */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MainKpiCard
          label="Faturamento Combustível"
          realizado={kpis.faturamentoCombustivel}
          projetado={projFaturamento}
          isProjectable={projection.isProjectable}
          daysElapsed={projection.daysElapsed}
          daysTotal={projection.daysTotal}
          daysRemaining={projection.daysRemaining}
          icon={DollarSign}
          cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          formatter={formatCurrency}
          onClick={() => navigate('/operacao?tab=caixa')}
        />
        <MainKpiCard
          label="Total Apurado"
          realizado={kpis.totalApurado}
          projetado={projApurado}
          isProjectable={projection.isProjectable}
          daysElapsed={projection.daysElapsed}
          daysTotal={projection.daysTotal}
          daysRemaining={projection.daysRemaining}
          icon={Wallet}
          cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          formatter={formatCurrency}
          onClick={() => navigate('/operacao?tab=caixa')}
        />
      </div>

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
              Projeção: {formatLiters(kpis.totalLitros * projection.scaleFactor)}
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
    </div>
  )
}

export default ResumoOperacao
