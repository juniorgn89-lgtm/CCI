import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KpiGrid from '@/components/kpi/KpiGrid'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import ErrorState from '@/components/feedback/ErrorState'
import EmptyState from '@/components/feedback/EmptyState'
import CrossFilterBanner from '@/components/feedback/CrossFilterBanner'
import ProductKpis from '@/pages/Produtos/components/ProductKpis'
import GroupTable from '@/pages/Produtos/components/GroupTable'
import ParetoChart from '@/pages/Produtos/components/ParetoChart'
import AbcCurve from '@/pages/Produtos/components/AbcCurve'
import useProductData from '@/pages/Produtos/hooks/useProductData'

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
    return <ErrorState />
  }

  if (groupTable.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="animate-fade-in space-y-6">
      <CrossFilterBanner />
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
