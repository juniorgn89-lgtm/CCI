import { useState } from 'react'
import { Fuel, CalendarDays, List, GaugeCircle, Users, DollarSign, Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import FuelKpis from '@/pages/Combustiveis/components/FuelKpis'
import AbastecimentosTable from '@/pages/Combustiveis/components/AbastecimentosTable'
import DailyTable from '@/pages/Combustiveis/components/DailyTable'
import FuelTypeTable from '@/pages/Combustiveis/components/FuelTypeTable'
import MonthlyChart from '@/pages/Combustiveis/components/MonthlyChart'
import WeeklyAnalysis from '@/pages/Combustiveis/components/WeeklyAnalysis'
import BombaView from '@/pages/Combustiveis/components/BombaView'
import FreentistaTable from '@/pages/Combustiveis/components/FreentistaTable'
import LbLitroView from '@/pages/Combustiveis/components/LbLitroView'
import useFuelData from '@/pages/Combustiveis/hooks/useFuelData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

type TabKey = 'indicadores' | 'abastecimentos' | 'diario' | 'tipo' | 'bombas' | 'frentistas' | 'lblitro'

const tabs: { key: TabKey; label: string; icon: typeof Fuel }[] = [
  { key: 'indicadores', label: 'Indicadores', icon: Activity },
  { key: 'abastecimentos', label: 'Abastecimentos', icon: List },
  { key: 'diario', label: 'Dia a dia', icon: CalendarDays },
  { key: 'tipo', label: 'Por combustível', icon: Fuel },
  { key: 'lblitro', label: 'L.B./Litro', icon: DollarSign },
  { key: 'bombas', label: 'Por bomba', icon: GaugeCircle },
  { key: 'frentistas', label: 'Frentistas', icon: Users },
]

const Combustiveis = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('indicadores')
  const { empresaCodigos } = useFilterStore()
  const { kpis, rows, dailyData, fuelTypeData, weeklyAnalysis, bombaData, frentistaData, lbLitroData, frentistas, combustiveis, isLoading } = useFuelData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  const handleNavigateTab = (tab: TabKey) => {
    setActiveTab(tab)
  }

  return (
    <div className="space-y-6">
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

      {empresaCodigos.length === 0 ? <SelectCompanyState /> : (<>
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
      {showSkeleton ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'indicadores' && kpis && (
            <div className="space-y-6">
              <FuelKpis kpis={kpis} onNavigateTab={handleNavigateTab} />
              <MonthlyChart data={dailyData} />
              <WeeklyAnalysis data={weeklyAnalysis} />
            </div>
          )}
          {activeTab === 'abastecimentos' && (
            <AbastecimentosTable data={rows} frentistas={frentistas} combustiveis={combustiveis} />
          )}
          {activeTab === 'diario' && <DailyTable data={dailyData} rows={rows} combustiveis={combustiveis} />}
          {activeTab === 'tipo' && <FuelTypeTable data={fuelTypeData} />}
          {activeTab === 'bombas' && <BombaView data={bombaData} />}
          {activeTab === 'lblitro' && <LbLitroView data={lbLitroData} />}
          {activeTab === 'frentistas' && <FreentistaTable data={frentistaData} />}
        </>
      )}
      </>)}
    </div>
  )
}

export default Combustiveis
