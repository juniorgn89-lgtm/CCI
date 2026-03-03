import { Droplets, DollarSign, Percent, Tag } from 'lucide-react'
import KpiCard from '@/components/kpi/KpiCard'
import KpiGrid from '@/components/kpi/KpiGrid'

interface FuelKpisProps {
  kpis: {
    litros: { value: string }
    faturamento: { value: string }
    margem: { value: string }
    precoMedio: { value: string }
  }
}

const FuelKpis = ({ kpis }: FuelKpisProps) => {
  return (
    <KpiGrid>
      <KpiCard label="Litros Vendidos" value={kpis.litros.value} icon={Droplets} />
      <KpiCard label="Faturamento" value={kpis.faturamento.value} icon={DollarSign} />
      <KpiCard label="Margem Média" value={kpis.margem.value} icon={Percent} />
      <KpiCard label="Preço Médio Venda" value={kpis.precoMedio.value} icon={Tag} />
    </KpiGrid>
  )
}

export default FuelKpis
