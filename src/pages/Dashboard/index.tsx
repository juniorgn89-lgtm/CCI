import { DollarSign, ShoppingCart, Receipt, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import KpiCard from '@/components/kpi/KpiCard'
import KpiGrid from '@/components/kpi/KpiGrid'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import ErrorState from '@/components/feedback/ErrorState'
import EmptyState from '@/components/feedback/EmptyState'
import SectorCards from '@/pages/Dashboard/components/SectorCards'
import ProjectionTable from '@/pages/Dashboard/components/ProjectionTable'
import SectorDetailTable from '@/pages/Dashboard/components/SectorDetailTable'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'

const SectorCardSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-5" />
      <Skeleton className="h-4 w-24" />
    </div>
    <Skeleton className="mt-3 h-7 w-32" />
    <Skeleton className="mt-2 h-4 w-28" />
  </div>
)

const Dashboard = () => {
  const { kpis, sectorCards, projectionData, companyDetailData, isLoading } = useDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <KpiGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </KpiGrid>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SectorCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton showHeader />
        <TableSkeleton showHeader />
      </div>
    )
  }

  if (!kpis) {
    return <ErrorState />
  }

  if (companyDetailData.length === 0 && projectionData.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="animate-fade-in space-y-6">
      <KpiGrid>
        <KpiCard
          label="Faturamento"
          value={kpis.faturamento.value}
          icon={DollarSign}
          variation={kpis.faturamento.variation}
          previousValue={kpis.faturamento.previousValue}
        />
        <KpiCard
          label="Volume de Vendas"
          value={kpis.volume.value}
          icon={ShoppingCart}
          variation={kpis.volume.variation}
          previousValue={kpis.volume.previousValue}
        />
        <KpiCard
          label="Ticket Médio"
          value={kpis.ticketMedio.value}
          icon={Receipt}
          variation={kpis.ticketMedio.variation}
          previousValue={kpis.ticketMedio.previousValue}
        />
        <KpiCard
          label="Projeção Mensal"
          value={kpis.projecao.value}
          icon={TrendingUp}
        />
      </KpiGrid>

      <SectorCards data={sectorCards} />

      <ProjectionTable data={projectionData} />

      <SectorDetailTable data={companyDetailData} />
    </div>
  )
}

export default Dashboard
