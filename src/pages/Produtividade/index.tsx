import { AlertCircle, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const ChartSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="space-y-3 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  </div>
)

const Produtividade = () => {
  const { champion, salesRanking, conversionRanking, ticketRanking, isLoading } = useProductivityData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ChampionSkeleton />
        <ChartSkeleton />
      </div>
    )
  }

  if (!salesRanking) {
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
