import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KpiGrid from '@/components/kpi/KpiGrid'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import ErrorState from '@/components/feedback/ErrorState'
import EmptyState from '@/components/feedback/EmptyState'
import FinanceKpis from '@/pages/Financeiro/components/FinanceKpis'
import ReceivablesTable from '@/pages/Financeiro/components/ReceivablesTable'
import PayablesTable from '@/pages/Financeiro/components/PayablesTable'
import CashFlowChart from '@/pages/Financeiro/components/CashFlowChart'
import DreTable from '@/pages/Financeiro/components/DreTable'
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'

const Financeiro = () => {
  const { kpis, receivablesData, payablesData, cashFlowData, dreData, isLoading } = useFinanceData()

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

  if (receivablesData.length === 0 && payablesData.length === 0 && cashFlowData.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="animate-fade-in space-y-6">
      <FinanceKpis kpis={kpis} />

      <Tabs defaultValue="receber">
        <TabsList>
          <TabsTrigger value="receber">Receber</TabsTrigger>
          <TabsTrigger value="pagar">Pagar</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
        </TabsList>

        <TabsContent value="receber">
          <ReceivablesTable data={receivablesData} />
        </TabsContent>

        <TabsContent value="pagar">
          <PayablesTable data={payablesData} />
        </TabsContent>

        <TabsContent value="fluxo">
          <CashFlowChart data={cashFlowData} />
        </TabsContent>

        <TabsContent value="dre">
          <DreTable data={dreData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Financeiro
