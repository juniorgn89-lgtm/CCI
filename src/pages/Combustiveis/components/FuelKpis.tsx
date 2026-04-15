import { Droplets, DollarSign, TrendingUp, Tag, Fuel, Receipt, BarChart3, ArrowUpRight, ArrowDownRight, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FuelKpiData } from '@/pages/Combustiveis/hooks/useFuelData'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type TabKey = 'indicadores' | 'abastecimentos' | 'diario' | 'tipo' | 'evolucao' | 'semanal' | 'bombas' | 'frentistas' | 'lblitro'

interface FuelKpisProps {
  kpis: FuelKpiData
  onNavigateTab?: (tab: TabKey) => void
}

interface KpiItem {
  label: string
  value: string
  icon: LucideIcon
  borderColor: string
  cardBg: string
  iconBg: string
  iconColor: string
  change: number
  navigateTo: TabKey
}

const pctChange = (current: number, prev: number) =>
  prev > 0 ? ((current - prev) / prev) * 100 : 0

const ChangeIndicator = ({ value }: { value: number }) => {
  if (value === 0) return null
  const positive = value > 0
  return (
    <span className="flex items-center gap-0.5 text-xs font-medium">
      {positive ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
      <span className={positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
        {positive ? '+' : ''}{value.toFixed(1)}%
      </span>
    </span>
  )
}

const FuelKpis = ({ kpis, onNavigateTab }: FuelKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Litros vendidos',
      value: formatLiters(kpis.litros),
      icon: Droplets,
      borderColor: 'border-blue-500',
      cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      change: pctChange(kpis.litros, kpis.prevMonth.litros),
      navigateTo: 'tipo',
    },
    {
      label: 'Faturamento',
      value: formatCurrency(kpis.faturamento),
      icon: DollarSign,
      borderColor: 'border-emerald-500',
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      change: pctChange(kpis.faturamento, kpis.prevMonth.faturamento),
      navigateTo: 'diario',
    },
    {
      label: 'Lucro bruto',
      value: formatCurrency(kpis.lucroBruto),
      icon: TrendingUp,
      borderColor: 'border-violet-500',
      cardBg: 'bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      change: pctChange(kpis.lucroBruto, kpis.prevMonth.lucroBruto),
      navigateTo: 'evolucao',
    },
    {
      label: 'Margem',
      value: `${kpis.margemPercent.toFixed(1)}%`,
      icon: BarChart3,
      borderColor: 'border-amber-500',
      cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      change: 0,
      navigateTo: 'tipo',
    },
    {
      label: 'Preco medio venda',
      value: formatCurrency(kpis.precoMedioVenda),
      icon: Tag,
      borderColor: 'border-cyan-500',
      cardBg: 'bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      change: 0,
      navigateTo: 'tipo',
    },
    {
      label: 'L.B. por litro',
      value: formatCurrency(kpis.lbPorLitro),
      icon: Fuel,
      borderColor: 'border-rose-500',
      cardBg: 'bg-gradient-to-br from-rose-50/60 to-white dark:from-rose-950/20 dark:to-gray-900',
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      change: 0,
      navigateTo: 'bombas',
    },
    {
      label: 'Abastecimentos',
      value: new Intl.NumberFormat('pt-BR').format(kpis.totalAbastecimentos),
      icon: Receipt,
      borderColor: 'border-indigo-500',
      cardBg: 'bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-gray-900',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      change: 0,
      navigateTo: 'abastecimentos',
    },
    {
      label: 'Ticket medio',
      value: formatCurrency(kpis.ticketMedio),
      icon: Users,
      borderColor: 'border-teal-500',
      cardBg: 'bg-gradient-to-br from-teal-50/60 to-white dark:from-teal-950/20 dark:to-gray-900',
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
      change: 0,
      navigateTo: 'frentistas',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            role={onNavigateTab ? 'button' : undefined}
            tabIndex={onNavigateTab ? 0 : undefined}
            onClick={() => onNavigateTab?.(item.navigateTo)}
            onKeyDown={(e) => {
              if (onNavigateTab && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onNavigateTab(item.navigateTo)
              }
            }}
            className={cn(
              'rounded-lg border border-gray-200/60 px-3 py-2.5 shadow-sm dark:border-gray-700/60',
              item.cardBg,
              onNavigateTab && 'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', item.iconBg)}>
                <Icon className={cn('h-3.5 w-3.5', item.iconColor)} />
              </div>
            </div>

            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {item.value}
            </p>

            {item.change !== 0 && (
              <div className="mt-0.5 flex items-center text-[11px] text-gray-500 dark:text-gray-400">
                <ChangeIndicator value={item.change} />
                <span className="ml-1 text-gray-400 dark:text-gray-500">vs mes anterior</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default FuelKpis
