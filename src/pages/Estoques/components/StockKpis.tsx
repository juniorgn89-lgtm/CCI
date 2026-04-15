import { Package, Layers, AlertTriangle, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import type { StockKpiData } from '@/pages/Estoques/hooks/useStockData'

type TabKey = 'posicao' | 'movimentacao' | 'alertas' | 'historico' | 'analise'
type AlertFilter = 'all' | 'danger' | 'warning' | 'caution'

interface StockKpisProps {
  kpis: StockKpiData
  onNavigate?: (tab: TabKey, alertFilter?: AlertFilter) => void
}

interface KpiItem {
  label: string
  value: string
  subtitle: string
  icon: LucideIcon
  cardBg: string
  iconBg: string
  iconColor: string
  targetTab: TabKey
  alertFilter?: AlertFilter
}

const StockKpis = ({ kpis, onNavigate }: StockKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Total de Produtos',
      value: formatNumber(kpis.totalProdutos),
      subtitle: 'produtos cadastrados',
      icon: Package,
      cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      targetTab: 'posicao',
    },
    {
      label: 'Saldo Total',
      value: formatNumber(kpis.saldoTotal),
      subtitle: 'unidades em estoque',
      icon: Layers,
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      targetTab: 'movimentacao',
    },
    {
      label: 'Estoque Baixo',
      value: formatNumber(kpis.produtosBaixoEstoque),
      subtitle: 'produtos abaixo do ideal',
      icon: AlertTriangle,
      cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      targetTab: 'alertas',
      alertFilter: 'caution',
    },
    {
      label: 'Sem Estoque',
      value: formatNumber(kpis.produtosSemEstoque),
      subtitle: 'produtos zerados',
      icon: XCircle,
      cardBg: 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      targetTab: 'alertas',
      alertFilter: 'danger',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate?.(item.targetTab, item.alertFilter)}
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
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              {item.subtitle}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export default StockKpis
