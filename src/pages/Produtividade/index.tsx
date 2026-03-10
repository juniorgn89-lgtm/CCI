import { useState } from 'react'
import { Users, BarChart3, TrendingUp, Receipt } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import EmptyState from '@/components/feedback/EmptyState'
import { cn } from '@/lib/utils'
import ChampionCard from '@/pages/Produtividade/components/ChampionCard'
import ProductivityKpis from '@/pages/Produtividade/components/ProductivityKpis'
import SalesRanking from '@/pages/Produtividade/components/SalesRanking'
import ConversionRanking from '@/pages/Produtividade/components/ConversionRanking'
import TicketRanking from '@/pages/Produtividade/components/TicketRanking'
import useProductivityData from '@/pages/Produtividade/hooks/useProductivityData'

type TabKey = 'geral' | 'conversao' | 'ticket'

const tabs: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: 'geral', label: 'Ranking Geral', icon: BarChart3 },
  { key: 'conversao', label: 'Conversao', icon: TrendingUp },
  { key: 'ticket', label: 'Ticket Medio', icon: Receipt },
]

const ChampionSkeleton = () => (
  <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6 shadow-sm dark:border-amber-700/50 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/20">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <div className="flex flex-1 flex-wrap gap-3 sm:justify-end">
        <Skeleton className="h-[68px] w-[160px] rounded-xl" />
        <Skeleton className="h-[68px] w-[140px] rounded-xl" />
        <Skeleton className="h-[68px] w-[140px] rounded-xl" />
      </div>
    </div>
  </div>
)

const KpiSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="mt-3 h-8 w-32" />
  </div>
)

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Produtividade = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('geral')
  const { champion, salesRanking, conversionRanking, ticketRanking, kpis, isLoading, hasEmpresa } = useProductivityData()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Produtividade</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ranking de vendedores, conversao e ticket medio
            </p>
          </div>
        </div>
      </div>

      {/* Empty state: no empresa selected */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content — only when empresa is selected */}
      {hasEmpresa && (
        <>
          {/* Champion Card */}
          {isLoading ? (
            <ChampionSkeleton />
          ) : champion ? (
            <ChampionCard champion={champion} />
          ) : null}

          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <ProductivityKpis kpis={kpis} />
          ) : null}

          {/* Empty state for no data */}
          {!isLoading && salesRanking.length === 0 && <EmptyState />}

          {/* Tabs + Content */}
          {!isLoading && salesRanking.length > 0 && (
            <>
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                        activeTab === tab.key
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {activeTab === 'geral' && <SalesRanking data={salesRanking} />}
              {activeTab === 'conversao' && <ConversionRanking data={conversionRanking} />}
              {activeTab === 'ticket' && <TicketRanking data={ticketRanking} />}
            </>
          )}

          {/* Loading state for content area */}
          {isLoading && <TableSkeleton />}
        </>
      )}
    </div>
  )
}

export default Produtividade
