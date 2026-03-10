import { Package, Layers, AlertTriangle, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  borderColor: string
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
      borderColor: 'border-blue-500',
      iconColor: 'text-blue-500',
      targetTab: 'posicao',
    },
    {
      label: 'Saldo Total',
      value: formatNumber(kpis.saldoTotal),
      subtitle: 'unidades em estoque',
      icon: Layers,
      borderColor: 'border-emerald-500',
      iconColor: 'text-emerald-500',
      targetTab: 'movimentacao',
    },
    {
      label: 'Estoque Baixo',
      value: formatNumber(kpis.produtosBaixoEstoque),
      subtitle: 'produtos abaixo do ideal',
      icon: AlertTriangle,
      borderColor: 'border-amber-500',
      iconColor: 'text-amber-500',
      targetTab: 'alertas',
      alertFilter: 'caution',
    },
    {
      label: 'Sem Estoque',
      value: formatNumber(kpis.produtosSemEstoque),
      subtitle: 'produtos zerados',
      icon: XCircle,
      borderColor: 'border-red-500',
      iconColor: 'text-red-500',
      targetTab: 'alertas',
      alertFilter: 'danger',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate?.(item.targetTab, item.alertFilter)}
            className={`rounded-xl border-l-4 ${item.borderColor} bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-gray-200 active:scale-[0.98] dark:bg-gray-900 dark:hover:ring-gray-700`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 ${item.iconColor}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {item.value}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {item.subtitle}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export default StockKpis
