import { DollarSign, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  cardBg: string
  iconBg: string
  iconColor: string
  targetTab: TabKey
}

const FinanceKpis = ({ kpis, onNavigate }: FinanceKpisProps) => {
  const items: KpiItem[] = [
    {
      label: 'Total a Receber',
      value: formatCurrency(kpis.totalReceber),
      subtitle: `${formatNumber(kpis.countReceber)} títulos${kpis.countVencidosReceber > 0 ? ` · ${kpis.countVencidosReceber} vencidos` : ''}`,
      icon: DollarSign,
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      targetTab: 'receber',
    },
    {
      label: 'Total a Pagar',
      value: formatCurrency(kpis.totalPagar),
      subtitle: `${formatNumber(kpis.countPagar)} títulos${kpis.countVencidosPagar > 0 ? ` · ${kpis.countVencidosPagar} vencidos` : ''}`,
      icon: CreditCard,
      cardBg: 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      targetTab: 'pagar',
    },
    {
      label: 'Saldo Líquido',
      value: formatCurrency(kpis.saldoLiquido),
      subtitle: kpis.saldoLiquido >= 0 ? 'Posição favorável' : 'Posição desfavorável',
      icon: TrendingUp,
      cardBg: kpis.saldoLiquido >= 0
        ? 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900'
        : 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      iconBg: kpis.saldoLiquido >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: kpis.saldoLiquido >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400',
      targetTab: 'fluxo',
    },
    {
      label: 'Inadimplência',
      value: formatCurrency(kpis.inadimplencia),
      subtitle: kpis.inadimplenciaPercent > 0
        ? `${kpis.inadimplenciaPercent.toFixed(1)}% do total a receber`
        : 'Nenhum título vencido',
      icon: AlertTriangle,
      cardBg: kpis.inadimplencia > 0
        ? 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900'
        : 'bg-gradient-to-br from-gray-50/60 to-white dark:from-gray-950/20 dark:to-gray-900',
      iconBg: kpis.inadimplencia > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-800',
      iconColor: kpis.inadimplencia > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400',
      targetTab: 'receber',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
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
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              {item.subtitle}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export default FinanceKpis
