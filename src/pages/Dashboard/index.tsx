import { Settings } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import QuickStats from '@/pages/Dashboard/components/QuickStats'
import SalesEvolutionChart from '@/pages/Dashboard/components/SalesEvolutionChart'
import FrentistaRanking from '@/pages/Dashboard/components/FrentistaRanking'
import DashboardSummary from '@/pages/Dashboard/components/DashboardSummary'
import SectorKpiCards from '@/pages/Dashboard/components/SectorKpiCards'
import SectorDetailSection from '@/pages/Dashboard/components/SectorDetailSection'
import DashboardSettings from '@/pages/Dashboard/components/DashboardSettings'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import { useFilterStore } from '@/store/filters'
import { useDashboardLayoutStore } from '@/store/dashboardLayout'

const KpiCardSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="mt-3 h-7 w-32" />
    <Skeleton className="mt-2 h-4 w-40" />
  </div>
)

const Dashboard = () => {
  const { empresaCodigos } = useFilterStore()
  const { sectorKpis, globalKpi, projectionData, sectorDetails, comparison, quickStats, salesEvolution, frentistaRanking, isLoading } = useDashboardData()
  const { sections } = useDashboardLayoutStore()
  const visibleSections = sections.filter((s) => s.visible)

  if (empresaCodigos.length === 0) {
    return (
      <div className="space-y-6">
        <SelectCompanyState />
      </div>
    )
  }

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'summary':
        return (
          <DashboardSummary
            key="summary"
            sectorKpis={sectorKpis}
            globalKpi={globalKpi}
            comparison={comparison}
          />
        )
      case 'sectorKpis':
        return (
          <SectorKpiCards
            key="sectorKpis"
            sectorKpis={sectorKpis}
            globalKpi={globalKpi}
            projectionData={projectionData}
          />
        )
      case 'sectorDetails':
        return <SectorDetailSection key="sectorDetails" sectorDetails={sectorDetails} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DashboardSettings />
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {/* Quick stats skeleton */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 border-l-4 border-l-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-5 w-24" />
              </div>
            ))}
          </div>
          {/* Chart + ranking skeleton */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-gray-700 dark:bg-gray-900">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-[300px] w-full" />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          </div>
          {/* Existing KPI skeleton */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* New top sections: Quick Stats + Chart/Ranking */}
          <QuickStats quickStats={quickStats} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesEvolutionChart salesEvolution={salesEvolution} />
            </div>
            <div>
              <FrentistaRanking frentistaRanking={frentistaRanking} />
            </div>
          </div>

          {/* Existing configurable sections */}
          {visibleSections.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
              <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma seção visível. Use o botão <span className="inline-flex align-middle"><Settings className="mx-0.5 inline h-4 w-4" /></span> para personalizar.
              </p>
            </div>
          ) : (
            visibleSections.map((section) => renderSection(section.id))
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard
