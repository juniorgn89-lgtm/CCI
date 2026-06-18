import { Fuel, Droplets, DollarSign, Percent, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLitersShort, formatCurrencyShort, formatPercent } from '@/lib/formatters'
import useGerenteMobileData from '@/pages/Gerente/hooks/useGerenteMobileData'
import GerenteFiltros from '@/pages/Gerente/components/GerenteFiltros'
import GerenteLoadingScreen from '@/pages/Gerente/components/GerenteLoadingScreen'
import { useFilterStore } from '@/store/filters'

const FUEL_COLORS = [
  { bg: 'bg-amber-50 dark:bg-amber-950/20', iconBg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-400', border: 'border-amber-200/60 dark:border-amber-800/40' },
  { bg: 'bg-blue-50 dark:bg-blue-950/20', iconBg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-400', border: 'border-blue-200/60 dark:border-blue-800/40' },
  { bg: 'bg-green-50 dark:bg-green-950/20', iconBg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', bar: 'bg-green-400', border: 'border-green-200/60 dark:border-green-800/40' },
  { bg: 'bg-violet-50 dark:bg-violet-950/20', iconBg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', bar: 'bg-violet-400', border: 'border-violet-200/60 dark:border-violet-800/40' },
]

const CombustiveisGerente = () => {
  const { combustiveis, fuelLitros, fuelFat, fuelMargem, isLoading, loadingStatus } = useGerenteMobileData()
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

  return (
    <div className="flex flex-col gap-4">
      <GerenteFiltros />

      {/* Summary strip */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200/60 bg-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]">
            <Fuel className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Combustíveis</p>
            <p className="text-[11px] text-gray-400">{combustiveis.length} produtos</p>
          </div>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[10px] text-gray-400">Total</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLitersShort(fuelLitros)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Fatur.</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(fuelFat)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Margem</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatPercent(fuelMargem)}</p>
          </div>
        </div>
      </div>

      {/* Per-combustível cards */}
      <div className="flex flex-col gap-3">
        {combustiveis.map((c, idx) => {
          const colors = FUEL_COLORS[idx % FUEL_COLORS.length]
          const kpis = [
            { label: 'Litros', value: formatLitersShort(c.litros), icon: Droplets },
            { label: 'Faturamento', value: formatCurrencyShort(c.faturamento), icon: DollarSign },
            { label: 'Margem', value: formatPercent(c.margem), icon: Percent },
          ]
          return (
            <div
              key={c.codigo}
              className={cn(
                'rounded-lg border px-4 py-3 shadow-sm',
                colors.border,
                colors.bg
              )}
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', colors.iconBg)}>
                    <Fuel className={cn('h-3.5 w-3.5', colors.text)} />
                  </div>
                  <p className={cn('text-sm font-bold', colors.text)}>{c.nome}</p>
                </div>
                <span className={cn('text-sm font-semibold', colors.text)}>
                  {c.participacao.toFixed(2)}% do total
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/60 dark:bg-gray-700/60">
                <div
                  className={cn('h-full rounded-full', colors.bar)}
                  style={{ width: `${c.participacao}%` }}
                />
              </div>

              {/* KPI mini-cards */}
              <div className="grid grid-cols-3 gap-2">
                {kpis.map((kpi) => {
                  const Icon = kpi.icon
                  return (
                    <div
                      key={kpi.label}
                      className="flex flex-col gap-0.5 rounded-md border border-white/60 bg-white/70 px-2.5 py-1.5 dark:border-gray-700/40 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-1">
                        <Icon className={cn('h-3 w-3', colors.text)} />
                        <p className="text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{kpi.label}</p>
                      </div>
                      <p className={cn('text-sm font-bold tabular-nums', colors.text)}>{kpi.value}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CombustiveisGerente
