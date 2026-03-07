import { Package, DollarSign, TrendingUp, BarChart3, ShoppingCart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ProductKpiData } from '@/pages/Produtos/hooks/useProductData'
import { formatCurrency, formatNumber } from '@/lib/formatters'

interface ProductKpisProps {
  kpis: ProductKpiData
}

interface KpiItem {
  label: string
  value: string
  icon: LucideIcon
  borderColor: string
  bgColor: string
  change: number
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

const ProductKpis = ({ kpis }: ProductKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Produtos vendidos',
      value: formatNumber(kpis.totalProdutosVendidos),
      icon: Package,
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-50/30 dark:bg-blue-950/30',
      change: 0,
    },
    {
      label: 'Faturamento',
      value: formatCurrency(kpis.faturamento),
      icon: DollarSign,
      borderColor: 'border-emerald-500',
      bgColor: 'bg-emerald-50/30 dark:bg-emerald-950/30',
      change: pctChange(kpis.faturamento, kpis.prevMonth.faturamento),
    },
    {
      label: 'Lucro bruto',
      value: formatCurrency(kpis.lucroBruto),
      icon: TrendingUp,
      borderColor: 'border-violet-500',
      bgColor: 'bg-violet-50/30 dark:bg-violet-950/30',
      change: pctChange(kpis.lucroBruto, kpis.prevMonth.lucroBruto),
    },
    {
      label: 'Margem',
      value: `${kpis.margemPct.toFixed(1)}%`,
      icon: BarChart3,
      borderColor: 'border-amber-500',
      bgColor: 'bg-amber-50/30 dark:bg-amber-950/30',
      change: 0,
    },
    {
      label: 'Qtd vendida',
      value: formatNumber(kpis.quantidade),
      icon: ShoppingCart,
      borderColor: 'border-cyan-500',
      bgColor: 'bg-cyan-50/30 dark:bg-cyan-950/30',
      change: pctChange(kpis.quantidade, kpis.prevMonth.quantidade),
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(kpis.ticketMedio),
      icon: DollarSign,
      borderColor: 'border-teal-500',
      bgColor: 'bg-teal-50/30 dark:bg-teal-950/30',
      change: 0,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className={`rounded-xl border-l-4 bg-white p-5 shadow-sm dark:bg-gray-900 ${item.borderColor} ${item.bgColor}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.label}</p>
              <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {item.value}
            </p>
            <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
              {item.change !== 0 ? <ChangeIndicator value={item.change} /> : <span>&nbsp;</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ProductKpis
