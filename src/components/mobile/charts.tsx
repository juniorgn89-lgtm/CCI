import { useId } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, PieChart, Pie,
} from 'recharts'
import { useThemeStore } from '@/store/theme'
import { ProgressBar } from '@/components/mobile/primitives'

/** Sequência de cores do gráfico por tema (README). */
export const useChartColors = (): string[] => {
  const dark = useThemeStore((s) => s.dark)
  return dark
    ? ['#60a5fa', '#3b82f6', '#2563eb', '#93c5fd', '#1e3a5f']
    : ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']
}

const gridColor = (dark: boolean) => (dark ? '#303030' : '#eef0f3')
const axisColor = (dark: boolean) => (dark ? '#767676' : '#9ca3af')

interface Datum { [k: string]: string | number }

/* ── Área (primária) + linha tracejada secundária opcional ── */
interface AreaChartMobileProps {
  data: Datum[]
  valueKey?: string
  /** Série secundária (ex.: margem) — linha tracejada no eixo direito oculto. */
  lineKey?: string
  labelKey?: string
  height?: number
}
export const AreaChartMobile = ({ data, valueKey = 'v', lineKey, labelKey = 'mes', height = 150 }: AreaChartMobileProps) => {
  const colors = useChartColors()
  const dark = useThemeStore((s) => s.dark)
  const gid = useId().replace(/:/g, '')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[0]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={colors[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={gridColor(dark)} strokeDasharray="3 3" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 9.5, fill: axisColor(dark) }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis yAxisId="left" hide domain={['dataMin', 'dataMax']} />
        {lineKey && <YAxis yAxisId="right" orientation="right" hide domain={['dataMin', 'dataMax']} />}
        <Area yAxisId="left" type="monotone" dataKey={valueKey} stroke={colors[0]} strokeWidth={2.2} fill={`url(#area-${gid})`} dot={false} activeDot={{ r: 3.4 }} />
        {lineKey && <Line yAxisId="right" type="monotone" dataKey={lineKey} stroke={colors[1]} strokeWidth={1.8} strokeDasharray="4 3" dot={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ── Barras verticais (último destacado) ── */
interface BarChartMobileProps {
  data: Datum[]
  valueKey?: string
  labelKey?: string
  height?: number
}
export const BarChartMobile = ({ data, valueKey = 'v', labelKey = 'mes', height = 150 }: BarChartMobileProps) => {
  const colors = useChartColors()
  const dark = useThemeStore((s) => s.dark)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke={gridColor(dark)} strokeDasharray="3 3" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 9.5, fill: axisColor(dark) }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide />
        <Bar dataKey={valueKey} radius={[3, 3, 0, 0]} maxBarSize={28}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === data.length - 1 ? colors[1] : colors[0]} fillOpacity={i === data.length - 1 ? 1 : 0.82} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Ranking de barras horizontais (label + barra + valor) ── */
interface HBarRankingProps<T> {
  data: T[]
  valueKey: keyof T
  labelKey: keyof T
  fmt?: (n: number) => string
  color?: string
  max?: number
}
export function HBarRanking<T extends Record<string, unknown>>({ data, valueKey, labelKey, fmt, color = '#2563eb', max }: HBarRankingProps<T>) {
  const mx = max ?? Math.max(...data.map((d) => Number(d[valueKey]) || 0), 0)
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0
        return (
          <div key={String(d[labelKey]) + i}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="max-w-[60%] truncate text-xs text-gray-500 dark:text-gray-400">
                <span className="mr-1.5 font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>
                {String(d[labelKey])}
              </span>
              <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt ? fmt(v) : v}</span>
            </div>
            <ProgressBar pct={mx > 0 ? (v / mx) * 100 : 0} color={color} height={6} />
          </div>
        )
      })}
    </div>
  )
}

/* ── Donut com total no centro + legenda lateral ── */
interface DonutDatum { nome: string; valor: number }
interface DonutMobileProps {
  data: DonutDatum[]
  centerTop?: string
  centerSub?: string
}
export const DonutMobile = ({ data, centerTop, centerSub }: DonutMobileProps) => {
  const colors = useChartColors()
  const total = data.reduce((s, d) => s + d.valor, 0)
  return (
    <div className="flex items-center gap-3.5">
      <div className="relative shrink-0" style={{ width: 124, height: 124 }}>
        <PieChart width={124} height={124}>
          <Pie data={data} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={40} outerRadius={58} startAngle={90} endAngle={-270} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
        </PieChart>
        {(centerTop || centerSub) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerTop && <span className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{centerTop}</span>}
            {centerSub && <span className="text-[9.5px] text-gray-400 dark:text-gray-500">{centerSub}</span>}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {data.map((d, i) => (
          <div key={d.nome} className="flex items-center gap-1.5 text-[11.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colors[i % colors.length] }} />
            <span className="flex-1 truncate text-gray-500 dark:text-gray-400">{d.nome}</span>
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{total > 0 ? Math.round((d.valor / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
