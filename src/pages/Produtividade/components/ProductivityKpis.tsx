import { Users, DollarSign, ShoppingCart, Receipt, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'

interface ProductivityKpisData {
  totalVendedores: number
  totalVendas: number
  totalQuantidade: number
  avgTicket: number
  avgConversao: number
}

interface ProductivityKpisProps {
  kpis: ProductivityKpisData
}

const ProductivityKpis = ({ kpis }: ProductivityKpisProps) => {
  const cards = [
    {
      label: 'Vendedores Ativos',
      value: formatNumber(kpis.totalVendedores),
      icon: Users,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-l-blue-500',
    },
    {
      label: 'Total Vendido',
      value: formatCurrency(kpis.totalVendas),
      icon: DollarSign,
      iconBg: 'bg-green-50 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-l-green-500',
    },
    {
      label: 'Total de Vendas',
      value: formatNumber(kpis.totalQuantidade),
      icon: ShoppingCart,
      iconBg: 'bg-purple-50 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-l-purple-500',
    },
    {
      label: 'Ticket Medio',
      value: formatCurrency(kpis.avgTicket),
      icon: Receipt,
      iconBg: 'bg-amber-50 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-l-amber-500',
    },
    {
      label: 'Conversao Media',
      value: `${kpis.avgConversao.toFixed(1)}%`,
      icon: TrendingUp,
      iconBg: 'bg-indigo-50 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      borderColor: 'border-l-indigo-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className={`rounded-xl border-l-4 ${card.borderColor} border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.label}</p>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                <Icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
          </div>
        )
      })}
    </div>
  )
}

export default ProductivityKpis
