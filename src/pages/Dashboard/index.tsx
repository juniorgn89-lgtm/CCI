import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Fuel, Gauge, Store, Package, Warehouse, DollarSign, Brain,
  Droplets, Receipt, TrendingUp, ArrowUpRight, ArrowRight,
  Lightbulb, AlertTriangle, Clock, Percent,
} from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import { useFilterStore } from '@/store/filters'
import { formatCurrency, formatLiters, formatNumber, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import DeltaBadge, { MarginBadge } from '@/components/kpi/DeltaBadge'

const moduleCards = [
  {
    label: 'Combustíveis',
    description: 'Abastecimentos e performance',
    path: '/combustiveis',
    icon: Fuel,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    label: 'Operação',
    description: 'Bombas, turnos e caixa',
    path: '/operacao',
    icon: Gauge,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-900/30',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    label: 'Conveniência',
    description: 'Vendas e estoque da loja',
    path: '/conveniencias',
    icon: Store,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/30',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    label: 'Produtos',
    description: 'Ranking e curva ABC',
    path: '/produtos',
    icon: Package,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    label: 'Estoques',
    description: 'Posição e alertas',
    path: '/estoques',
    icon: Warehouse,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    label: 'Financeiro',
    description: 'Receber, pagar e DRE',
    path: '/financeiro',
    icon: DollarSign,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'hover:border-green-300 dark:hover:border-green-700',
  },
  {
    label: 'Inteligência',
    description: 'Comparação entre postos',
    path: '/inteligencia',
    icon: Brain,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'hover:border-purple-300 dark:hover:border-purple-700',
  },
]

const Dashboard = () => {
  const navigate = useNavigate()
  const { empresaCodigos } = useFilterStore()
  const { quickStats, comparison, frentistaRanking, globalKpi, isLoading } = useDashboardData()
  const showSkeleton = useShowSkeleton(isLoading, !!quickStats)

  const insights = useMemo(() => {
    if (!quickStats || !comparison) return []
    const items: { type: 'positive' | 'warning' | 'info'; text: string }[] = []

    // Faturamento vs mês anterior
    if (comparison.prevMonth.faturamento > 0) {
      const change = ((quickStats.receitaDia - comparison.prevMonth.faturamento) / comparison.prevMonth.faturamento) * 100
      items.push({
        type: change >= 0 ? 'positive' : 'warning',
        text: `Receita ${change >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(change).toFixed(1)}% em relação ao mês anterior`,
      })
    }

    // Faturamento vs ano anterior
    if (comparison.prevYear.faturamento > 0) {
      const change = ((quickStats.receitaDia - comparison.prevYear.faturamento) / comparison.prevYear.faturamento) * 100
      items.push({
        type: change >= 0 ? 'positive' : 'warning',
        text: `Receita ${change >= 0 ? 'subiu' : 'caiu'} ${Math.abs(change).toFixed(1)}% comparado ao mesmo período do ano anterior`,
      })
    }

    // Abastecimentos vs mês anterior
    if (comparison.prevMonth.abastecimentos > 0) {
      const change = ((quickStats.totalAbastecimentos - comparison.prevMonth.abastecimentos) / comparison.prevMonth.abastecimentos) * 100
      items.push({
        type: change >= 0 ? 'positive' : 'warning',
        text: `Volume de abastecimentos ${change >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(change).toFixed(1)}% vs mês anterior (${formatNumber(quickStats.totalAbastecimentos)} vs ${formatNumber(comparison.prevMonth.abastecimentos)})`,
      })
    }

    // Margem
    if (quickStats.margemMedia >= 30) {
      items.push({ type: 'positive', text: `Margem média saudável de ${quickStats.margemMedia.toFixed(1)}%` })
    } else if (quickStats.margemMedia > 0 && quickStats.margemMedia < 15) {
      items.push({ type: 'warning', text: `Margem média baixa: ${quickStats.margemMedia.toFixed(1)}%. Atenção na precificação.` })
    }

    // Top frentista
    if (frentistaRanking && frentistaRanking.length > 0) {
      const top = frentistaRanking[0]
      items.push({
        type: 'info',
        text: `${top.nome} lidera com ${formatLiters(top.litros)} vendidos no período`,
      })
    }

    // Lucro bruto
    if (globalKpi && globalKpi.lucroBruto > 0) {
      items.push({
        type: 'info',
        text: `Lucro bruto total de ${formatCurrency(globalKpi.lucroBruto)} no período`,
      })
    }

    const order = { positive: 0, info: 1, warning: 2 }
    items.sort((a, b) => order[a.type] - order[b.type])
    return items
  }, [quickStats, comparison, frentistaRanking, globalKpi])

  if (empresaCodigos.length === 0) {
    return (
      <div className="space-y-6">
        <SelectCompanyState />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <LayoutDashboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Visão geral do desempenho</p>
          </div>
        </div>
      </div>

      {/* Quick KPIs */}
      {showSkeleton ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : quickStats && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-blue-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-blue-950/20 dark:to-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Litros Vendidos</p>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
                <Droplets className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(quickStats.litrosVendidos)}</p>
          </div>
          <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-emerald-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-emerald-950/20 dark:to-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Receita</p>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(quickStats.receitaDia)}</p>
            <DeltaBadge current={quickStats.receitaDia} previous={comparison.prevMonth.faturamento} />
          </div>
          <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-amber-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-amber-950/20 dark:to-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ticket Médio</p>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
                <Receipt className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(quickStats.ticketMedio)}</p>
          </div>
          <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-indigo-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-indigo-950/20 dark:to-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Abastecimentos</p>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                <Fuel className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(quickStats.totalAbastecimentos)}</p>
            <DeltaBadge
              current={quickStats.totalAbastecimentos}
              previous={comparison.prevMonth.abastecimentos}
              showAbsolute
              formatter={formatNumber}
            />
          </div>
          <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-rose-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-rose-950/20 dark:to-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Margem</p>
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-100 dark:bg-rose-900/30">
                <Percent className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatPercent(quickStats.margemMedia)}</p>
            <MarginBadge value={quickStats.margemMedia} threshold={5} />
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resumo do Período</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2.5',
                  ins.type === 'positive' && 'border-l-4 border-green-500 bg-green-50 dark:bg-green-950/30',
                  ins.type === 'warning' && 'border-l-4 border-red-500 bg-red-50 dark:bg-red-950/30',
                  ins.type === 'info' && 'border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/30',
                )}
              >
                {ins.type === 'positive' && <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />}
                {ins.type === 'warning' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                {ins.type === 'info' && <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
                <p className="text-xs text-gray-700 dark:text-gray-300">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module navigation cards */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Módulos</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {moduleCards.map((mod) => {
            const Icon = mod.icon
            return (
              <button
                key={mod.path}
                onClick={() => navigate(mod.path)}
                className={cn(
                  'group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900',
                  mod.border
                )}
              >
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', mod.bg)}>
                  <Icon className={cn('h-5 w-5', mod.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{mod.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{mod.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
