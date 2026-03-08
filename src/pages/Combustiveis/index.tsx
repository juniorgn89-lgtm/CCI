import { useState } from 'react'
import { Fuel, CalendarDays, BarChart3, Calendar, List } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import FuelKpis from '@/pages/Combustiveis/components/FuelKpis'
import AbastecimentosTable from '@/pages/Combustiveis/components/AbastecimentosTable'
import DailyTable from '@/pages/Combustiveis/components/DailyTable'
import FuelTypeTable from '@/pages/Combustiveis/components/FuelTypeTable'
import MonthlyChart from '@/pages/Combustiveis/components/MonthlyChart'
import WeeklyAnalysis from '@/pages/Combustiveis/components/WeeklyAnalysis'
import useFuelData from '@/pages/Combustiveis/hooks/useFuelData'

type TabKey = 'abastecimentos' | 'diario' | 'tipo' | 'evolucao' | 'semanal'

const tabs: { key: TabKey; label: string; icon: typeof Fuel }[] = [
  { key: 'abastecimentos', label: 'Abastecimentos', icon: List },
  { key: 'diario', label: 'Dia a dia', icon: CalendarDays },
  { key: 'tipo', label: 'Por combustível', icon: Fuel },
  { key: 'evolucao', label: 'Evolução', icon: BarChart3 },
  { key: 'semanal', label: 'Semanal', icon: Calendar },
]

const KpiSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <Skeleton className="h-10 w-10 rounded-lg" />
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-2 h-4 w-24" />
  </div>
)

const Combustiveis = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('abastecimentos')
  const { empresaCodigo } = useFilterStore()
  const { kpis, rows, dailyData, fuelTypeData, weeklyAnalysis, frentistas, combustiveis, isLoading } = useFuelData()

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Fuel className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Combustíveis</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Acompanhamento de abastecimentos e performance</p>
          </div>
        </div>
      </div>

      {!empresaCodigo ? <SelectCompanyState /> : (<>
      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : kpis ? (
        <FuelKpis kpis={kpis} />
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
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'abastecimentos' && (
            <AbastecimentosTable data={rows} frentistas={frentistas} combustiveis={combustiveis} />
          )}
          {activeTab === 'diario' && <DailyTable data={dailyData} />}
          {activeTab === 'tipo' && <FuelTypeTable data={fuelTypeData} />}
          {activeTab === 'evolucao' && <MonthlyChart data={dailyData} />}
          {activeTab === 'semanal' && <WeeklyAnalysis data={weeklyAnalysis} />}
        </>
      )}
      </>)}
    </div>
  )
}

export default Combustiveis
