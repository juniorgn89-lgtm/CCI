import { Skeleton } from '@/components/ui/skeleton'
import DashboardSummary from '@/pages/Dashboard/components/DashboardSummary'
import SectorKpiCards from '@/pages/Dashboard/components/SectorKpiCards'
import SectorDetailSection from '@/pages/Dashboard/components/SectorDetailSection'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'

const KpiCardSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="mt-3 h-7 w-32" />
    <Skeleton className="mt-2 h-4 w-40" />
  </div>
)

const Dashboard = () => {
  const { sectorKpis, globalKpi, projectionData, sectorDetails, comparison, isLoading } = useDashboardData()

  return (
    <div className="animate-fade-in space-y-6">
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
        </div>
      ) : (
        <>
          <DashboardSummary sectorKpis={sectorKpis} globalKpi={globalKpi} comparison={comparison} />

          <SectorKpiCards
            sectorKpis={sectorKpis}
            globalKpi={globalKpi}
            projectionData={projectionData}
          />

          <SectorDetailSection sectorDetails={sectorDetails} />
        </>
      )}
    </div>
  )
}

export default Dashboard
