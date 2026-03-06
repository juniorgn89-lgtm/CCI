import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KpiGrid from '@/components/kpi/KpiGrid'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import ErrorState from '@/components/feedback/ErrorState'
import EmptyState from '@/components/feedback/EmptyState'
import CrossFilterBanner from '@/components/feedback/CrossFilterBanner'
import FuelKpis from '@/pages/Combustiveis/components/FuelKpis'
import DailyTable from '@/pages/Combustiveis/components/DailyTable'
import FuelTypeTable from '@/pages/Combustiveis/components/FuelTypeTable'
import MonthlyChart from '@/pages/Combustiveis/components/MonthlyChart'
import WeeklyAnalysis from '@/pages/Combustiveis/components/WeeklyAnalysis'
import useFuelData from '@/pages/Combustiveis/hooks/useFuelData'

const Combustiveis = () => {
  const { kpis, dailyData, fuelTypeData, monthlyEvolution, weeklyAnalysis, isLoading } = useFuelData()

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
      <FuelKpis kpis={kpis} />

      <Tabs defaultValue="diario">
        <TabsList>
          <TabsTrigger value="diario">Dia a Dia</TabsTrigger>
          <TabsTrigger value="tipo">Por Combustível</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="semanal">Semanal</TabsTrigger>
        </TabsList>

        <TabsContent value="diario">
          <DailyTable data={dailyData} />
        </TabsContent>

        <TabsContent value="tipo">
          <FuelTypeTable data={fuelTypeData} />
        </TabsContent>

        <TabsContent value="evolucao">
          <MonthlyChart data={monthlyEvolution} />
        </TabsContent>

        <TabsContent value="semanal">
          <WeeklyAnalysis data={weeklyAnalysis} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Combustiveis
