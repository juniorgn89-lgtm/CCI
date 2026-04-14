import { useEffect, useState } from 'react'
import { Fuel, CalendarDays, List, GaugeCircle, Users, DollarSign, Activity, Settings } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { useCombustiveisLayout } from '@/store/moduleLayout'
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

const TAB_ICONS: Record<string, typeof Fuel> = {
  indicadores: Activity,
  abastecimentos: List,
  diario: CalendarDays,
  tipo: Fuel,
  lblitro: DollarSign,
  bombas: GaugeCircle,
  frentistas: Users,
}

const Combustiveis = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useCombustiveisLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'indicadores')
  const { empresaCodigos } = useFilterStore()
  const { kpis, rows, dailyData, fuelTypeData, weeklyAnalysis, bombaData, frentistaData, lbLitroData, frentistas, combustiveis, isLoading } = useFuelData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'indicadores')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Fuel className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Combustíveis</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Acompanhamento de abastecimentos e performance</p>
          </div>
        </div>
        <ModuleSettings title="Combustíveis" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </div>

      {empresaCodigos.length === 0 ? <SelectCompanyState /> : (<>
      {visibleTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma aba visível. Use o botão ⚙️ para personalizar.</p>
        </div>
      ) : (<>
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {visibleTabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id] ?? Activity
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all', activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300')}>
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {showSkeleton ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {activeTab === 'indicadores' && kpis && (
            <div className="space-y-6">
              <FuelKpis kpis={kpis} onNavigateTab={setActiveTab} />
              <MonthlyChart data={dailyData} />
              <WeeklyAnalysis data={weeklyAnalysis} />
            </div>
          )}
          {activeTab === 'abastecimentos' && <AbastecimentosTable data={rows} frentistas={frentistas} combustiveis={combustiveis} />}
          {activeTab === 'diario' && <DailyTable data={dailyData} rows={rows} combustiveis={combustiveis} />}
          {activeTab === 'tipo' && <FuelTypeTable data={fuelTypeData} />}
          {activeTab === 'bombas' && <BombaView data={bombaData} />}
          {activeTab === 'lblitro' && <LbLitroView data={lbLitroData} />}
          {activeTab === 'frentistas' && <FreentistaTable data={frentistaData} />}
        </>
      )}
      </>)}
      </>)}
    </div>
  )
}

export default Combustiveis
