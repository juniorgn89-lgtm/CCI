import { Fuel, Droplets, DollarSign, Receipt, Users, Gauge, Wallet, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import type { OperacaoKpiData } from '@/pages/Operacao/hooks/useOperacaoData'

type TabKey = 'indicadores' | 'bombas' | 'abastecimentos' | 'caixa' | 'produtividade'

interface OperacaoKpisProps {
  kpis: OperacaoKpiData
  onNavigateTab: (tab: TabKey) => void
}

interface KpiCardConfig {
  label: string
  value: string
  icon: typeof Fuel
  iconColor: string
  iconBg: string
  cardBg: string
  tab: TabKey
}

const OperacaoKpis = ({ kpis, onNavigateTab }: OperacaoKpisProps) => {
  const cards: KpiCardConfig[] = [
    {
      label: 'Abastecimentos',
      value: formatNumber(kpis.totalAbastecimentos),
      icon: Fuel,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
      tab: 'abastecimentos',
    },
    {
      label: 'Litros Vendidos',
      value: formatLiters(kpis.totalLitros),
      icon: Droplets,
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      cardBg: 'bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900',
      tab: 'abastecimentos',
    },
    {
      label: 'Faturamento',
      value: formatCurrency(kpis.faturamentoCombustivel),
      icon: DollarSign,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
      tab: 'caixa',
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(kpis.ticketMedio),
      icon: Receipt,
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      cardBg: 'bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900',
      tab: 'abastecimentos',
    },
    {
      label: 'Frentistas Ativos',
      value: formatNumber(kpis.frentistasAtivos),
      icon: Users,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
      tab: 'produtividade',
    },
    {
      label: 'Bombas Ativas',
      value: formatNumber(kpis.bombasAtivas),
      icon: Gauge,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      cardBg: 'bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-gray-900',
      tab: 'bombas',
    },
    {
      label: 'Caixas Abertos',
      value: formatNumber(kpis.caixasAbertos),
      icon: Wallet,
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      cardBg: 'bg-gradient-to-br from-orange-50/60 to-white dark:from-orange-950/20 dark:to-gray-900',
      tab: 'caixa',
    },
    {
      label: 'Total Apurado',
      value: formatCurrency(kpis.totalApurado),
      icon: TrendingUp,
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-900/30',
      cardBg: 'bg-gradient-to-br from-teal-50/60 to-white dark:from-teal-950/20 dark:to-gray-900',
      tab: 'caixa',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <button
            key={card.label}
            onClick={() => onNavigateTab(card.tab)}
            className={cn(
              'rounded-lg border border-gray-200/60 px-3 py-2.5 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 dark:border-gray-700/60',
              card.cardBg
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
              <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', card.iconBg)}>
                <Icon className={cn('h-3.5 w-3.5', card.iconColor)} />
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
          </button>
        )
      })}
    </div>
  )
}

export default OperacaoKpis
