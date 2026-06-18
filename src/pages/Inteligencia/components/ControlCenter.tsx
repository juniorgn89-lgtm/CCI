import { Activity, Fuel, Receipt, Target, TrendingUp, AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostoData, NetworkAlert } from '../hooks/useNetworkData'

interface Props {
  postos: PostoData[]
  networkTotals: {
    receita: number
    litros: number
    abastecimentos: number
    ticketMedio: number
    conversao: number
  }
  alerts: NetworkAlert[]
}

const fmt = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
      ? `R$ ${(v / 1_000).toFixed(1)}K`
      : `R$ ${v.toFixed(2)}`

const fmtNum = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `${(v / 1_000).toFixed(1)}K`
      : v.toFixed(0)

const alertConfig = {
  danger: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
}

const ControlCenter = ({ postos, networkTotals, alerts }: Props) => {
  const aboveAvg = postos.filter(p => p.performance === 'above').length
  const belowAvg = postos.filter(p => p.performance === 'below').length
  const avgScore = postos.length > 0 ? Math.round(postos.reduce((s, p) => s + p.score, 0) / postos.length) : 0

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {[
          { label: 'Litros da Rede', value: `${fmtNum(networkTotals.litros)}L`, icon: Fuel, color: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/30', gradient: 'from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900' },
          { label: 'Faturamento Total', value: fmt(networkTotals.receita), icon: Receipt, color: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', gradient: 'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900' },
          { label: 'Abastecimentos', value: fmtNum(networkTotals.abastecimentos), icon: Target, color: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/30', gradient: 'from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900' },
          { label: 'Ticket Médio', value: fmt(networkTotals.ticketMedio), icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/30', gradient: 'from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900' },
          { label: 'Conversão Média', value: `${networkTotals.conversao.toFixed(2)}%`, icon: Activity, color: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-900/30', gradient: 'from-rose-50/60 to-white dark:from-rose-950/20 dark:to-gray-900' },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className={cn('rounded-lg border border-gray-200/60 bg-gradient-to-br px-3 py-2.5 shadow-sm dark:border-gray-700/60', item.gradient)}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', item.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', item.color)} />
                </div>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{item.value}</p>
            </div>
          )
        })}
      </div>

      {/* Network health + Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Network health */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Saúde da Rede</h3>
          </div>
          <div className="space-y-5 p-5">
            {/* Score gauge */}
            <div className="flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-gray-700" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={avgScore >= 70 ? '#22c55e' : avgScore >= 50 ? '#eab308' : '#ef4444'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${avgScore * 2.64} 264`}
                  />
                </svg>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{avgScore}</p>
                  <p className="text-[10px] text-gray-500">SCORE</p>
                </div>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Acima da média</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{aboveAvg}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Na média</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{postos.length - aboveAvg - belowAvg}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Abaixo da média</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{belowAvg}</span>
              </div>
            </div>

            {/* Health bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              {postos.length > 0 && (
                <>
                  <div className="bg-emerald-500 transition-all" style={{ width: `${(aboveAvg / postos.length) * 100}%` }} />
                  <div className="bg-yellow-500 transition-all" style={{ width: `${((postos.length - aboveAvg - belowAvg) / postos.length) * 100}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${(belowAvg / postos.length) * 100}%` }} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Alerts panel */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Painel de Alertas</h3>
            </div>
            {alerts.length > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {alerts.length} alertas
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12">
              <ShieldAlert className="h-10 w-10 text-emerald-300 dark:text-emerald-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhum alerta ativo</p>
              <p className="text-xs text-gray-400">Todos os postos estão dentro dos parâmetros esperados.</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {alerts.map((alert, i) => {
                const config = alertConfig[alert.type]
                const Icon = config.icon
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 border-b border-gray-50 px-5 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50',
                      i === 0 && 'rounded-t-xl'
                    )}
                  >
                    <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', config.bg)}>
                      <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{alert.posto}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{alert.message}</p>
                    </div>
                    <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', config.dotColor)} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick posto status grid */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Status dos Postos</h3>
        </div>
        <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-800 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
          {postos.map(p => (
            <div
              key={p.empresaCodigo}
              className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800 sm:border-b sm:border-r"
            >
              <div className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                p.performance === 'above' ? 'bg-emerald-500' : p.performance === 'below' ? 'bg-red-500' : 'bg-yellow-500'
              )} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.fantasia}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{fmt(p.receita)}</span>
                <span className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white',
                  p.score >= 70 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                )}>
                  {p.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ControlCenter
