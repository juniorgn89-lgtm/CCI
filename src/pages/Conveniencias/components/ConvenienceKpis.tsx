import { DollarSign, TrendingUp, Package, Receipt } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabKey = 'diario' | 'grupo' | 'evolucao'

interface ConvenienceKpisProps {
  kpis: {
    faturamento: { value: string }
    margem: { value: string }
    qtdItens: { value: string }
    ticketMedio: { value: string }
  }
  onNavigateTab?: (tab: TabKey) => void
}

interface KpiItem {
  label: string
  value: string
  subtitle: string
  icon: LucideIcon
  borderColor: string
  iconBg: string
  iconColor: string
  navigateTo: TabKey
}

const ConvenienceKpis = ({ kpis, onNavigateTab }: ConvenienceKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Faturamento',
      value: kpis.faturamento.value,
      subtitle: 'receita total no periodo',
      icon: DollarSign,
      borderColor: 'border-emerald-500',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      navigateTo: 'diario',
    },
    {
      label: 'Margem',
      value: kpis.margem.value,
      subtitle: 'lucro bruto do periodo',
      icon: TrendingUp,
      borderColor: 'border-blue-500',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      navigateTo: 'evolucao',
    },
    {
      label: 'Qtd Itens',
      value: kpis.qtdItens.value,
      subtitle: 'itens vendidos',
      icon: Package,
      borderColor: 'border-violet-500',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      navigateTo: 'grupo',
    },
    {
      label: 'Ticket Medio',
      value: kpis.ticketMedio.value,
      subtitle: 'valor medio por item',
      icon: Receipt,
      borderColor: 'border-amber-500',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      navigateTo: 'diario',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              'rounded-xl border-l-4 bg-white p-5 shadow-sm dark:bg-gray-900',
              item.borderColor,
              onNavigateTab && 'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]'
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', item.iconBg)}>
                <Icon className={cn('h-4 w-4', item.iconColor)} />
              </div>
            </div>

            <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {item.value}
            </p>

            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {item.subtitle}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default ConvenienceKpis
