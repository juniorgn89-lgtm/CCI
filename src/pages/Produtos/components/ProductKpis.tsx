import { Package, DollarSign, TrendingUp, BarChart3, ShoppingCart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProductKpiData } from '@/pages/Produtos/hooks/useProductData'
import { formatCurrency, formatNumber } from '@/lib/formatters'

type TabKey = 'produtos' | 'top' | 'pareto' | 'abc'

interface ProductKpisProps {
  kpis: ProductKpiData
  onNavigate?: (tab: TabKey) => void
}

interface KpiItem {
  label: string
  value: string
  icon: LucideIcon
  cardBg: string
  iconBg: string
  iconColor: string
  change: number
  targetTab: TabKey
}

const pctChange = (current: number, prev: number) =>
  prev > 0 ? ((current - prev) / prev) * 100 : 0

const ChangeIndicator = ({ value }: { value: number }) => {
  if (value === 0) return null
  const positive = value > 0
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-medium">
      {positive ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
      <span className={positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
        {positive ? '+' : ''}{value.toFixed(1)}%
      </span>
    </span>
  )
}

const ProductKpis = ({ kpis, onNavigate }: ProductKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Produtos vendidos',
      value: formatNumber(kpis.totalProdutosVendidos),
      icon: Package,
      cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      change: 0,
      targetTab: 'produtos',
    },
    {
      label: 'Faturamento',
      value: formatCurrency(kpis.faturamento),
      icon: DollarSign,
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      change: pctChange(kpis.faturamento, kpis.prevMonth.faturamento),
      targetTab: 'pareto',
    },
    {
      label: 'Lucro bruto',
      value: formatCurrency(kpis.lucroBruto),
      icon: TrendingUp,
      cardBg: 'bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      change: pctChange(kpis.lucroBruto, kpis.prevMonth.lucroBruto),
      targetTab: 'produtos',
    },
    {
      label: 'Margem',
      value: `${kpis.margemPct.toFixed(1)}%`,
      icon: BarChart3,
      cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      change: 0,
      targetTab: 'abc',
    },
    {
      label: 'Qtd vendida',
      value: formatNumber(kpis.quantidade),
      icon: ShoppingCart,
      cardBg: 'bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      change: pctChange(kpis.quantidade, kpis.prevMonth.quantidade),
      targetTab: 'top',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(kpis.ticketMedio),
      icon: DollarSign,
      cardBg: 'bg-gradient-to-br from-teal-50/60 to-white dark:from-teal-950/20 dark:to-gray-900',
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
      change: 0,
      targetTab: 'produtos',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate?.(item.targetTab)}
            className={cn(
              'rounded-lg border border-gray-200/60 px-3 py-2.5 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 dark:border-gray-700/60',
              item.cardBg
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
              <div className="mt-0.5">
                <ChangeIndicator value={item.change} />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default ProductKpis
