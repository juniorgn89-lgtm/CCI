import { Package, Warehouse, RefreshCw } from 'lucide-react'
import KpiCard from '@/components/kpi/KpiCard'
import KpiGrid from '@/components/kpi/KpiGrid'

interface StockKpisProps {
  kpis: {
    totalItens: { value: string }
    totalSaldo: { value: string }
    giroMedio: { value: string }
  }
}

const StockKpis = ({ kpis }: StockKpisProps) => {
  return (
    <KpiGrid>
      <KpiCard label="Total de Itens" value={kpis.totalItens.value} icon={Package} />
      <KpiCard label="Saldo Total" value={kpis.totalSaldo.value} icon={Warehouse} />
      <KpiCard label="Giro Médio" value={kpis.giroMedio.value} icon={RefreshCw} />
    </KpiGrid>
  )
}

export default StockKpis
