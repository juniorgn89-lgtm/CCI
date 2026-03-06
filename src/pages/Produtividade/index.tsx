import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import ErrorState from '@/components/feedback/ErrorState'
import EmptyState from '@/components/feedback/EmptyState'
import ChampionCard from '@/pages/Produtividade/components/ChampionCard'
import SalesRanking from '@/pages/Produtividade/components/SalesRanking'
import ConversionRanking from '@/pages/Produtividade/components/ConversionRanking'
import TicketRanking from '@/pages/Produtividade/components/TicketRanking'
import useProductivityData from '@/pages/Produtividade/hooks/useProductivityData'

const ChampionSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-6">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="flex gap-8">
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-12 w-24" />
      </div>
    </div>
  </div>
)

const Produtividade = () => {
  const { champion, salesRanking, conversionRanking, ticketRanking, isLoading } = useProductivityData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ChampionSkeleton />
        <TableSkeleton rows={6} />
      </div>
    )
  }

  if (!salesRanking) {
    return <ErrorState />
  }

  if (salesRanking.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="animate-fade-in space-y-6">
      {champion && <ChampionCard champion={champion} />}

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Ranking Geral</TabsTrigger>
          <TabsTrigger value="conversao">Conversão</TabsTrigger>
          <TabsTrigger value="ticket">Ticket Médio</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <SalesRanking data={salesRanking} />
        </TabsContent>

        <TabsContent value="conversao">
          <ConversionRanking data={conversionRanking} />
        </TabsContent>

        <TabsContent value="ticket">
          <TicketRanking data={ticketRanking} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Produtividade
