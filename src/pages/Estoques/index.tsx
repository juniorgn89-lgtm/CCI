import KpiGrid from '@/components/kpi/KpiGrid'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import ErrorState from '@/components/feedback/ErrorState'
import EmptyState from '@/components/feedback/EmptyState'
import StockKpis from '@/pages/Estoques/components/StockKpis'
import StockTable from '@/pages/Estoques/components/StockTable'
import StockMovementChart from '@/pages/Estoques/components/StockMovementChart'
import useStockData from '@/pages/Estoques/hooks/useStockData'

const Estoques = () => {
  const { kpis, stockTable, movementData, isLoading } = useStockData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <KpiGrid>
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </KpiGrid>
        <TableSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  if (!kpis) {
    return <ErrorState />
  }

  if (stockTable.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="animate-fade-in space-y-6">
      <StockKpis kpis={kpis} />
      <StockTable data={stockTable} />
      <StockMovementChart data={movementData} />
    </div>
  )
}

export default Estoques
