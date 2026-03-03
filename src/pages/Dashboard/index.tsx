import { DollarSign, ShoppingCart, Receipt, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import KpiCard from '@/components/kpi/KpiCard'
import KpiGrid from '@/components/kpi/KpiGrid'
import SectorCards from '@/pages/Dashboard/components/SectorCards'
import ProjectionTable from '@/pages/Dashboard/components/ProjectionTable'
import SectorDetailTable from '@/pages/Dashboard/components/SectorDetailTable'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'

const KpiSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-5" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="mt-3 h-8 w-36" />
    <Skeleton className="mt-2 h-4 w-28" />
  </div>
)

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

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-200 px-6 py-4">
      <Skeleton className="h-5 w-40" />
    </div>
    <div className="space-y-3 p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
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
        <TableSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  if (!kpis) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="mt-3 text-sm font-medium text-gray-700">
          Não foi possível carregar os dados.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Verifique sua conexão e tente novamente.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
