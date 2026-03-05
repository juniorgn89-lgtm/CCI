import { DollarSign, Package, Percent, Receipt } from 'lucide-react'
import KpiCard from '@/components/kpi/KpiCard'
import KpiGrid from '@/components/kpi/KpiGrid'

interface ProductKpisProps {
  kpis: {
    faturamento: { value: string }
    quantidade: { value: string }
    margem: { value: string }
    ticketMedio: { value: string }
  }
}

const ProductKpis = ({ kpis }: ProductKpisProps) => {
  return (
    <KpiGrid>
      <KpiCard label="Faturamento" value={kpis.faturamento.value} icon={DollarSign} />
      <KpiCard label="Qtd Vendida" value={kpis.quantidade.value} icon={Package} />
      <KpiCard label="Margem Total" value={kpis.margem.value} icon={Percent} />
      <KpiCard label="Ticket Médio" value={kpis.ticketMedio.value} icon={Receipt} />
    </KpiGrid>
  )
}

export default ProductKpis
