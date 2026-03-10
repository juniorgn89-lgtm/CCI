import { DollarSign, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import type { FinanceKpiData } from '@/pages/Financeiro/hooks/useFinanceData'

type TabKey = 'receber' | 'pagar' | 'fluxo' | 'dre'

interface FinanceKpisProps {
  kpis: FinanceKpiData
  onNavigate?: (tab: TabKey) => void
}

interface KpiItem {
  label: string
  value: string
  subtitle: string
  icon: LucideIcon
  borderColor: string
  iconColor: string
  iconBg: string
  targetTab: TabKey
}

const FinanceKpis = ({ kpis, onNavigate }: FinanceKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Total a Receber',
      value: formatCurrency(kpis.totalReceber),
      subtitle: `${formatNumber(kpis.countReceber)} títulos pendentes${kpis.countVencidosReceber > 0 ? ` · ${kpis.countVencidosReceber} vencidos` : ''}`,
      icon: DollarSign,
      borderColor: 'border-emerald-500',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
      targetTab: 'receber',
    },
    {
      label: 'Total a Pagar',
      value: formatCurrency(kpis.totalPagar),
      subtitle: `${formatNumber(kpis.countPagar)} títulos pendentes${kpis.countVencidosPagar > 0 ? ` · ${kpis.countVencidosPagar} vencidos` : ''}`,
      icon: CreditCard,
      borderColor: 'border-red-500',
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-50 dark:bg-red-900/30',
      targetTab: 'pagar',
    },
    {
      label: 'Saldo Líquido',
      value: formatCurrency(kpis.saldoLiquido),
      subtitle: kpis.saldoLiquido >= 0 ? 'Posição favorável' : 'Posição desfavorável',
      icon: TrendingUp,
      borderColor: kpis.saldoLiquido >= 0 ? 'border-blue-500' : 'border-amber-500',
      iconColor: kpis.saldoLiquido >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400',
      iconBg: kpis.saldoLiquido >= 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-amber-50 dark:bg-amber-900/30',
      targetTab: 'fluxo',
    },
    {
      label: 'Inadimplência',
      value: formatCurrency(kpis.inadimplencia),
      subtitle: kpis.inadimplenciaPercent > 0
        ? `${kpis.inadimplenciaPercent.toFixed(1)}% do total a receber`
        : 'Nenhum título vencido',
      icon: AlertTriangle,
      borderColor: kpis.inadimplencia > 0 ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600',
      iconColor: kpis.inadimplencia > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400',
      iconBg: kpis.inadimplencia > 0 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-gray-50 dark:bg-gray-800',
      targetTab: 'receber',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.iconBg} ${item.iconColor}`}>
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

export default FinanceKpis
