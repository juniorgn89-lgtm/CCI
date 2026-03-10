import { Package, DollarSign, TrendingUp, BarChart3, ShoppingCart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  subtitle: string
  icon: LucideIcon
  borderColor: string
  iconColor: string
  change: number
  targetTab: TabKey
}

const pctChange = (current: number, prev: number) =>
  prev > 0 ? ((current - prev) / prev) * 100 : 0

const ChangeIndicator = ({ value }: { value: number }) => {
  if (value === 0) return <span className="text-xs text-gray-400 dark:text-gray-500">sem comparativo</span>
  const positive = value > 0
  return (
    <span className="flex items-center gap-0.5 text-xs font-medium">
      {positive ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
      <span className={positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
        {positive ? '+' : ''}{value.toFixed(1)}% vs mês anterior
      </span>
    </span>
  )
}

const ProductKpis = ({ kpis, onNavigate }: ProductKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Produtos vendidos',
      value: formatNumber(kpis.totalProdutosVendidos),
      subtitle: 'itens distintos',
      icon: Package,
      borderColor: 'border-blue-500',
      iconColor: 'text-blue-500',
      change: 0,
      targetTab: 'produtos',
    },
    {
      label: 'Faturamento',
      value: formatCurrency(kpis.faturamento),
      subtitle: 'receita total no período',
      icon: DollarSign,
      borderColor: 'border-emerald-500',
      iconColor: 'text-emerald-500',
      change: pctChange(kpis.faturamento, kpis.prevMonth.faturamento),
      targetTab: 'pareto',
    },
    {
      label: 'Lucro bruto',
      value: formatCurrency(kpis.lucroBruto),
      subtitle: 'faturamento - custo',
      icon: TrendingUp,
      borderColor: 'border-violet-500',
      iconColor: 'text-violet-500',
      change: pctChange(kpis.lucroBruto, kpis.prevMonth.lucroBruto),
      targetTab: 'produtos',
    },
    {
      label: 'Margem',
      value: `${kpis.margemPct.toFixed(1)}%`,
      subtitle: 'margem bruta média',
      icon: BarChart3,
      borderColor: 'border-amber-500',
      iconColor: 'text-amber-500',
      change: 0,
      targetTab: 'abc',
    },
    {
      label: 'Qtd vendida',
      value: formatNumber(kpis.quantidade),
      subtitle: 'unidades vendidas',
      icon: ShoppingCart,
      borderColor: 'border-cyan-500',
      iconColor: 'text-cyan-500',
      change: pctChange(kpis.quantidade, kpis.prevMonth.quantidade),
      targetTab: 'top',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(kpis.ticketMedio),
      subtitle: 'valor médio por venda',
      icon: DollarSign,
      borderColor: 'border-teal-500',
      iconColor: 'text-teal-500',
      change: 0,
      targetTab: 'produtos',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate?.(item.targetTab)}
            className={`rounded-xl border-l-4 ${item.borderColor} bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-gray-200 active:scale-[0.98] dark:bg-gray-900 dark:hover:ring-gray-700`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 ${item.iconColor}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {item.value}
            </p>
            <div className="mt-1">
              {item.change !== 0 ? (
                <ChangeIndicator value={item.change} />
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">{item.subtitle}</p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default ProductKpis
