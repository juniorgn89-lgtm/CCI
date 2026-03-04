import { AlertCircle, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KpiGrid from '@/components/kpi/KpiGrid'
import FuelKpis from '@/pages/Combustiveis/components/FuelKpis'
import DailyTable from '@/pages/Combustiveis/components/DailyTable'
import FuelTypeTable from '@/pages/Combustiveis/components/FuelTypeTable'
import MonthlyChart from '@/pages/Combustiveis/components/MonthlyChart'
import WeeklyAnalysis from '@/pages/Combustiveis/components/WeeklyAnalysis'
import useFuelData from '@/pages/Combustiveis/hooks/useFuelData'

const KpiSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-5" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="mt-3 h-8 w-36" />
  </div>
)

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  </div>
)

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
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="mt-3 text-sm font-medium text-gray-700">
          Não foi possível carregar os dados.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Verifique sua conexão e tente novamente.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
