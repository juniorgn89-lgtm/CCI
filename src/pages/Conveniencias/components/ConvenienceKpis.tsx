import { DollarSign, TrendingUp, Package, Receipt } from 'lucide-react'
import KpiCard from '@/components/kpi/KpiCard'
import KpiGrid from '@/components/kpi/KpiGrid'

interface ConvenienceKpisProps {
  kpis: {
    faturamento: { value: string }
    margem: { value: string }
    qtdItens: { value: string }
    ticketMedio: { value: string }
  }
}

const ConvenienceKpis = ({ kpis }: ConvenienceKpisProps) => {
  return (
    <KpiGrid>
      <KpiCard label="Faturamento" value={kpis.faturamento.value} icon={DollarSign} />
      <KpiCard label="Margem" value={kpis.margem.value} icon={TrendingUp} />
      <KpiCard label="Qtd Itens" value={kpis.qtdItens.value} icon={Package} />
      <KpiCard label="Ticket Médio" value={kpis.ticketMedio.value} icon={Receipt} />
    </KpiGrid>
  )
}

export default ConvenienceKpis
