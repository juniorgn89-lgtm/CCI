import { DollarSign, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react'
import KpiCard from '@/components/kpi/KpiCard'
import KpiGrid from '@/components/kpi/KpiGrid'

interface FinanceKpisProps {
  kpis: {
    totalReceber: { value: string }
    totalPagar: { value: string }
    saldoLiquido: { value: string }
    inadimplencia: { value: string }
  }
}

const FinanceKpis = ({ kpis }: FinanceKpisProps) => {
  return (
    <KpiGrid>
      <KpiCard label="Total a Receber" value={kpis.totalReceber.value} icon={DollarSign} />
      <KpiCard label="Total a Pagar" value={kpis.totalPagar.value} icon={CreditCard} />
      <KpiCard label="Saldo Líquido" value={kpis.saldoLiquido.value} icon={TrendingUp} />
      <KpiCard label="Inadimplência" value={kpis.inadimplencia.value} icon={AlertTriangle} />
    </KpiGrid>
  )
}

export default FinanceKpis
