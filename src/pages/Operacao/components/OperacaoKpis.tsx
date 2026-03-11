import { Fuel, Droplets, DollarSign, Receipt, Users, Gauge, Wallet, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import type { OperacaoKpiData } from '@/pages/Operacao/hooks/useOperacaoData'

type TabKey = 'bombas' | 'abastecimentos' | 'turnos' | 'caixa' | 'produtividade'

interface OperacaoKpisProps {
  kpis: OperacaoKpiData
  onNavigateTab: (tab: TabKey) => void
}

interface KpiCardConfig {
  label: string
  value: string
  icon: typeof Fuel
  color: string
  borderColor: string
  bgColor: string
  tab: TabKey
}

const OperacaoKpis = ({ kpis, onNavigateTab }: OperacaoKpisProps) => {
  const cards: KpiCardConfig[] = [
    {
      label: 'Abastecimentos',
      value: formatNumber(kpis.totalAbastecimentos),
      icon: Fuel,
      color: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/30',
      tab: 'abastecimentos',
    },
    {
      label: 'Litros Vendidos',
      value: formatLiters(kpis.totalLitros),
      icon: Droplets,
      color: 'text-cyan-600 dark:text-cyan-400',
      borderColor: 'border-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/30',
      tab: 'abastecimentos',
    },
    {
      label: 'Faturamento Combustível',
      value: formatCurrency(kpis.faturamentoCombustivel),
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/30',
      tab: 'caixa',
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(kpis.ticketMedio),
      icon: Receipt,
      color: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/30',
      tab: 'abastecimentos',
    },
    {
      label: 'Frentistas Ativos',
      value: formatNumber(kpis.frentistasAtivos),
      icon: Users,
      color: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/30',
      tab: 'produtividade',
    },
    {
      label: 'Bombas Ativas',
      value: formatNumber(kpis.bombasAtivas),
      icon: Gauge,
      color: 'text-indigo-600 dark:text-indigo-400',
      borderColor: 'border-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
      tab: 'bombas',
    },
    {
      label: 'Caixas Abertos',
      value: formatNumber(kpis.caixasAbertos),
      icon: Wallet,
      color: 'text-orange-600 dark:text-orange-400',
      borderColor: 'border-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/30',
      tab: 'turnos',
    },
    {
      label: 'Total Apurado',
      value: formatCurrency(kpis.totalApurado),
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
      tab: 'caixa',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <button
            key={card.label}
            onClick={() => onNavigateTab(card.tab)}
            className={cn(
              'rounded-xl border-l-4 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:bg-gray-900',
              card.borderColor
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', card.bgColor)}>
                <Icon className={cn('h-3.5 w-3.5', card.color)} />
              </div>
            </div>
            <p className="mt-2 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
          </button>
        )
      })}
    </div>
  )
}

export default OperacaoKpis
