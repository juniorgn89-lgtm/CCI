import { AlertCircle, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import KpiGrid from '@/components/kpi/KpiGrid'
import StockKpis from '@/pages/Estoques/components/StockKpis'
import StockTable from '@/pages/Estoques/components/StockTable'
import StockMovementChart from '@/pages/Estoques/components/StockMovementChart'
import useStockData from '@/pages/Estoques/hooks/useStockData'

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
      <StockKpis kpis={kpis} />
      <StockTable data={stockTable} />
      <StockMovementChart data={movementData} />
    </div>
  )
}

export default Estoques
