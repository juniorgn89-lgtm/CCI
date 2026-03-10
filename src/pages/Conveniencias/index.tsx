import { useState } from 'react'
import { Store, CalendarDays, Layers, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import ConvenienceKpis from '@/pages/Conveniencias/components/ConvenienceKpis'
import DailyTable from '@/pages/Conveniencias/components/DailyTable'
import GroupTable from '@/pages/Conveniencias/components/GroupTable'
import RevenueChart from '@/pages/Conveniencias/components/RevenueChart'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'

type TabKey = 'diario' | 'grupo' | 'evolucao'

const tabs: { key: TabKey; label: string; icon: typeof Store }[] = [
  { key: 'diario', label: 'Dia a Dia', icon: CalendarDays },
  { key: 'grupo', label: 'Por Grupo', icon: Layers },
  { key: 'evolucao', label: 'Evolucao', icon: TrendingUp },
]

const KpiSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-2 h-3 w-20" />
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

const Conveniencias = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('diario')
  const { kpis, dailyData, groupTable, revenueData, isLoading, hasEmpresa } = useConvenienceData()

  const handleNavigateTab = (tab: TabKey) => {
    setActiveTab(tab)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Conveniencias</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Vendas de loja, grupos e evolucao de receita
            </p>
          </div>
        </div>
      </div>

      {/* Empty state: no empresa selected */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content — only when empresa is selected */}
      {hasEmpresa && (
        <>
          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <ConvenienceKpis kpis={kpis} onNavigateTab={handleNavigateTab} />
          ) : null}

          {/* Tabs */}
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

          {/* Content */}
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <>
              {activeTab === 'diario' && <DailyTable data={dailyData} />}
              {activeTab === 'grupo' && <GroupTable data={groupTable} />}
              {activeTab === 'evolucao' && <RevenueChart data={revenueData} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Conveniencias
