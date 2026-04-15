import { DollarSign, TrendingUp, Package, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import type { ConvKpiData } from '@/pages/Conveniencias/hooks/useConvenienceData'

type TabKey = 'indicadores' | 'vendas' | 'catalogo' | 'estoque' | 'topVendidos' | 'performance'

interface ConvenienceKpisProps {
  kpis: ConvKpiData
  onNavigateTab?: (tab: TabKey) => void
}

interface KpiItem {
  label: string
  value: string
  subtitle: string
  icon: LucideIcon
  cardBg: string
  iconBg: string
  iconColor: string
  navigateTo: TabKey
  change?: number
}

const ConvenienceKpis = ({ kpis, onNavigateTab }: ConvenienceKpisProps) => {
  const fatChange = kpis.prev.faturamento > 0
    ? ((kpis.faturamento - kpis.prev.faturamento) / kpis.prev.faturamento) * 100
    : undefined

  const margemChange = kpis.prev.margem > 0
    ? ((kpis.margem - kpis.prev.margem) / kpis.prev.margem) * 100
    : undefined

  const qtdChange = kpis.prev.qtdItens > 0
    ? ((kpis.qtdItens - kpis.prev.qtdItens) / kpis.prev.qtdItens) * 100
    : undefined

  const items: KpiItem[] = [
    {
      label: 'Faturamento',
      value: formatCurrency(kpis.faturamento),
      subtitle: 'receita total no período',
      icon: DollarSign,
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      navigateTo: 'vendas',
      change: fatChange,
    },
    {
      label: 'Margem Bruta',
      value: formatCurrency(kpis.margem),
      subtitle: `${kpis.margemPct.toFixed(1)}% de margem`,
      icon: TrendingUp,
      cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      navigateTo: 'catalogo',
      change: margemChange,
    },
    {
      label: 'Itens Vendidos',
      value: formatNumber(kpis.qtdItens),
      subtitle: `${kpis.totalProdutos} produtos distintos`,
      icon: Package,
      cardBg: 'bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      navigateTo: 'topVendidos',
      change: qtdChange,
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(kpis.ticketMedio),
      subtitle: 'valor médio por venda',
      icon: Receipt,
      cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      navigateTo: 'vendas',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        const isPositive = item.change !== undefined && item.change >= 0
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

            <div className="mt-0.5 flex items-center gap-1.5">
              {item.change !== undefined ? (
                <span className={cn(
                  'inline-flex items-center gap-0.5 text-[11px] font-medium',
                  isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(item.change).toFixed(1)}%
                </span>
              ) : (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{item.subtitle}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ConvenienceKpis
