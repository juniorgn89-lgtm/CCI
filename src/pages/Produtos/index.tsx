import { AlertCircle, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KpiGrid from '@/components/kpi/KpiGrid'
import ProductKpis from '@/pages/Produtos/components/ProductKpis'
import GroupTable from '@/pages/Produtos/components/GroupTable'
import ParetoChart from '@/pages/Produtos/components/ParetoChart'
import AbcCurve from '@/pages/Produtos/components/AbcCurve'
import useProductData from '@/pages/Produtos/hooks/useProductData'

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

const Produtos = () => {
  const { kpis, groupTable, paretoData, abcData, isLoading } = useProductData()

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
      <ProductKpis kpis={kpis} />

      <Tabs defaultValue="grupo">
        <TabsList>
          <TabsTrigger value="grupo">Por Grupo</TabsTrigger>
          <TabsTrigger value="pareto">Pareto</TabsTrigger>
          <TabsTrigger value="abc">Curva ABC</TabsTrigger>
        </TabsList>

        <TabsContent value="grupo">
          <GroupTable data={groupTable} />
        </TabsContent>

        <TabsContent value="pareto">
          <ParetoChart data={paretoData} />
        </TabsContent>

        <TabsContent value="abc">
          <AbcCurve data={abcData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Produtos
