import { DollarSign, Droplets, Percent, Fuel, Receipt, TrendingUp, Medal, Building2, TrendingDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyShort, formatLitersShort, formatPercent, formatCurrency } from '@/lib/formatters'
import useGerenteMobileData from '@/pages/Gerente/hooks/useGerenteMobileData'
import GerenteFiltros from '@/pages/Gerente/components/GerenteFiltros'
import { useFilterStore } from '@/store/filters'
import GerenteLoadingScreen from '@/pages/Gerente/components/GerenteLoadingScreen'

const FUEL_COLORS: Record<number, { bg: string; text: string; bar: string }> = {
  1: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-400' },
  2: { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-400' },
  3: { bg: 'bg-green-50 dark:bg-green-950/20', text: 'text-green-700 dark:text-green-300', bar: 'bg-green-400' },
  4: { bg: 'bg-violet-50 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-300', bar: 'bg-violet-400' },
}
const getFuelColor = (idx: number) => FUEL_COLORS[(idx % 4) + 1]

const MEDAL_COLORS = ['text-amber-500', 'text-gray-400', 'text-orange-400']

const DeltaBadge = ({ value, loading }: { value: number | null; loading: boolean }) => {
  if (loading) {
    return (
      <div className="mt-1 flex items-center gap-1 text-gray-300 dark:text-gray-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-[10px]">calculando...</span>
      </div>
    )
  }
  if (value === null) return null
  const positive = value >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <div className={cn(
      'mt-1 flex items-center gap-1',
      positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
    )}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] font-semibold tabular-nums">
        {positive ? '+' : ''}{value.toFixed(0)}% vs anterior
      </span>
    </div>
  )
}

const Inicio = () => {
  const {
    faturamentoGlobal,
    fuelLitros,
    fuelMargem,
    totalAbastecimentos,
    ticketMedio,
    combustiveis,
    frentistaRanking,
    porEmpresa,
    deltas,
    isLoading,
    isLoadingDeltas,
    loadingStatus,
  } = useGerenteMobileData()
  const { empresaCodigos } = useFilterStore()

  if (!empresaCodigos.length) {
    return (
      <div className="flex flex-col gap-4">
        <GerenteFiltros />
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f]/10">
            <Building2 className="h-7 w-7 text-[#1e3a5f]/60 dark:text-blue-400/60" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Selecione uma empresa</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">para visualizar os dados</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <GerenteFiltros />
        <GerenteLoadingScreen status={loadingStatus} />
      </div>
    )
  }

  const kpis = [
    {
      label: 'Faturamento',
      value: formatCurrencyShort(faturamentoGlobal),
      delta: deltas.faturamento,
      icon: DollarSign,
      bg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Litros',
      value: formatLitersShort(fuelLitros),
      delta: deltas.litros,
      icon: Droplets,
      bg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Margem',
      value: formatPercent(fuelMargem),
      delta: null,
      icon: Percent,
      bg: 'bg-gradient-to-br from-rose-50/60 to-white dark:from-rose-950/20 dark:to-gray-900',
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      label: 'Abast.',
      value: String(totalAbastecimentos.toLocaleString('pt-BR')),
      delta: deltas.abastecimentos,
      icon: Fuel,
      bg: 'bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-gray-900',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Ticket Médio',
      value: formatCurrencyShort(ticketMedio),
      delta: deltas.ticketMedio,
      icon: Receipt,
      bg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <GerenteFiltros />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className={cn(
                'rounded-lg border border-gray-200/60 px-3 py-2.5 shadow-sm dark:border-gray-700/60',
                kpi.bg,
                kpi.label === 'Ticket Médio' && 'col-span-2'
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', kpi.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', kpi.iconColor)} />
                </div>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {kpi.value}
              </p>
              <DeltaBadge value={kpi.delta} loading={isLoadingDeltas && kpi.delta === null} />
            </div>
          )
        })}
      </div>

      {/* Multi-empresa breakdown */}
      {porEmpresa.length > 1 && (
        <div className="rounded-lg border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]/10">
              <TrendingUp className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Por Posto</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {porEmpresa.map((e, idx) => {
              const pct = faturamentoGlobal > 0 ? (e.faturamento / faturamentoGlobal) * 100 : 0
              return (
                <div key={e.codigo} className={cn('px-4 py-2.5', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{e.nome}</p>
                    <p className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrencyShort(e.faturamento)}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-[#1e3a5f]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Combustíveis breakdown */}
      {combustiveis.length > 0 && (
        <div className="rounded-lg border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]/10">
              <Fuel className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Combustíveis</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {combustiveis.map((c, idx) => {
              const colors = getFuelColor(idx)
              return (
                <div key={c.codigo} className={cn('px-4 py-2.5', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2 w-2 rounded-full', colors.bar)} />
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.nome}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] text-gray-500">
                        {formatLitersShort(c.litros)}
                      </p>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', colors.bg, colors.text)}>
                        {formatPercent(c.margem)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className={cn('h-full rounded-full', colors.bar)}
                      style={{ width: `${c.participacao}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top 3 frentistas */}
      {frentistaRanking.length > 0 && (
        <div className="rounded-lg border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]/10">
              <Medal className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Top Frentistas</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {frentistaRanking.slice(0, 3).map((f, idx) => (
              <div key={f.codigo} className={cn('flex items-center gap-3 px-4 py-2.5', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                <span className={cn('text-base font-bold', MEDAL_COLORS[idx] ?? 'text-gray-400')}>
                  #{idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{f.nome}</p>
                  <p className="text-[10px] text-gray-400">{f.atendimentos} atend.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatLitersShort(f.litros)}
                  </p>
                  <p className="text-[10px] tabular-nums text-gray-400">
                    {formatCurrency(f.receita).replace('R$\u00a0', 'R$ ').replace(',00', '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Inicio
