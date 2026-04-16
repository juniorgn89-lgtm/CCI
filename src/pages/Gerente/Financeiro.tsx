import { DollarSign, TrendingUp, Percent, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyShort, formatPercent } from '@/lib/formatters'
import useGerenteMobileData from '@/pages/Gerente/hooks/useGerenteMobileData'
import GerenteFiltros from '@/pages/Gerente/components/GerenteFiltros'
import GerenteLoadingScreen from '@/pages/Gerente/components/GerenteLoadingScreen'
import { useFilterStore } from '@/store/filters'

// Estimated non-fuel margin blend: 30% automotivos (66%) + 70% conveniência (50%)
const NON_FUEL_MARGIN = 0.30 * 0.66 + 0.70 * 0.50

const Financeiro = () => {
  const { faturamentoGlobal, fuelFat, fuelMargem, porEmpresa, isLoading, loadingStatus } = useGerenteMobileData()
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

  // Estimates
  const nonFuelFat = Math.max(0, faturamentoGlobal - fuelFat)
  const fuelLB = fuelFat * (fuelMargem / 100)
  const nonFuelLB = nonFuelFat * NON_FUEL_MARGIN
  const lucroBrutoTotal = fuelLB + nonFuelLB
  const margemGlobal = faturamentoGlobal > 0 ? (lucroBrutoTotal / faturamentoGlobal) * 100 : 0

  const sectors = [
    {
      label: 'Combustíveis',
      faturamento: fuelFat,
      lucroBruto: fuelLB,
      margem: fuelMargem,
      bg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      barColor: 'bg-blue-500',
    },
    {
      label: 'Outros',
      faturamento: nonFuelFat,
      lucroBruto: nonFuelLB,
      margem: NON_FUEL_MARGIN * 100,
      bg: 'bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      barColor: 'bg-violet-500',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <GerenteFiltros />

      {/* Global KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="col-span-3 rounded-lg border border-gray-200/60 bg-gradient-to-br from-emerald-50/60 to-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:from-emerald-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Faturamento Total</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrencyShort(faturamentoGlobal)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-teal-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-teal-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Lucro Bruto</p>
            <TrendingUp className="h-3.5 w-3.5 text-teal-500" />
          </div>
          <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrencyShort(lucroBrutoTotal)}
          </p>
        </div>

        <div className="col-span-2 rounded-lg border border-gray-200/60 bg-gradient-to-br from-rose-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-rose-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Margem Global</p>
            <Percent className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatPercent(margemGlobal)}
          </p>
        </div>
      </div>

      {/* Sector breakdown */}
      <div className="rounded-lg border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]/10">
            <TrendingUp className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Por Setor</span>
        </div>

        {sectors.map((s, idx) => (
          <div key={s.label} className={cn('px-4 py-3', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{s.label}</p>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', s.iconBg, s.iconColor)}>
                {formatPercent(s.margem)} margem
              </span>
            </div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[10px] text-gray-400">Faturamento</p>
                  <p className="text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyShort(s.faturamento)}</p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className={cn('h-full rounded-full', s.barColor)}
                    style={{ width: faturamentoGlobal > 0 ? `${(s.faturamento / faturamentoGlobal) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400">Lucro</p>
                <p className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(s.lucroBruto)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Por posto */}
      {porEmpresa.length > 1 && (
        <div className="rounded-lg border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]/10">
              <Building2 className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Por Posto</span>
          </div>
          {porEmpresa.map((e, idx) => {
            const pct = faturamentoGlobal > 0 ? (e.faturamento / faturamentoGlobal) * 100 : 0
            return (
              <div key={e.codigo} className={cn('px-4 py-2.5', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{e.nome}</p>
                  <p className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(e.faturamento)}</p>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-full rounded-full bg-[#1e3a5f]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Financeiro
