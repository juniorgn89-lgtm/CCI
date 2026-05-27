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
import { Wallet, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatLiters } from '@/lib/formatters'

/**
 * Gráficos diários do Resumo do posto (Apurado + Litros). Isolado num módulo
 * próprio e carregado via lazy() pelo ResumoOperacao — assim o recharts
 * (~320 kB) só baixa quando há gráfico pra mostrar; os KPIs aparecem antes.
 */

export interface DailyPoint {
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

interface ResumoChartsProps {
  apuradoChartData: DailyPoint[]
  litrosChartData: DailyPoint[]
  isProjectable: boolean
  projApurado: number
  projLitros: number
}

const ResumoCharts = ({ apuradoChartData, litrosChartData, isProjectable, projApurado, projLitros }: ResumoChartsProps) => {
  return (
    <>
      {/* Mini-gráfico: Apurado diário com projeção */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 [mask-image:linear-gradient(to_bottom,black_calc(100%-14px),transparent_100%)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Wallet className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Apurado diário
          </h3>
          {isProjectable && (
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 [mask-image:linear-gradient(to_bottom,black_calc(100%-14px),transparent_100%)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Droplets className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Litros vendidos diários
          </h3>
          {isProjectable && (
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
  )
}

export default ResumoCharts
