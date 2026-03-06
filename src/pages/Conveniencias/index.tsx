import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KpiGrid from '@/components/kpi/KpiGrid'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import ErrorState from '@/components/feedback/ErrorState'
import EmptyState from '@/components/feedback/EmptyState'
import CrossFilterBanner from '@/components/feedback/CrossFilterBanner'
import ConvenienceKpis from '@/pages/Conveniencias/components/ConvenienceKpis'
import DailyTable from '@/pages/Conveniencias/components/DailyTable'
import GroupTable from '@/pages/Conveniencias/components/GroupTable'
import RevenueChart from '@/pages/Conveniencias/components/RevenueChart'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'

const Conveniencias = () => {
  const { kpis, dailyData, groupTable, revenueData, isLoading } = useConvenienceData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <KpiGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </KpiGrid>
        <TableSkeleton />
      </div>
    )
  }

  if (!kpis) {
    return <ErrorState />
  }

  if (dailyData.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="animate-fade-in space-y-6">
      <CrossFilterBanner />
      <ConvenienceKpis kpis={kpis} />

      <Tabs defaultValue="diario">
        <TabsList>
          <TabsTrigger value="diario">Dia a Dia</TabsTrigger>
          <TabsTrigger value="grupo">Por Grupo</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="diario">
          <DailyTable data={dailyData} />
        </TabsContent>

        <TabsContent value="grupo">
          <GroupTable data={groupTable} />
        </TabsContent>

        <TabsContent value="evolucao">
          <RevenueChart data={revenueData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Conveniencias
