import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import type { RankingRow } from '@/pages/Produtividade/hooks/useProductivityData'

interface SalesRankingProps {
  data: RankingRow[]
}

const formatCurrencyShort = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`
  return `R$ ${value.toFixed(0)}`
}

const SalesRanking = ({ data }: SalesRankingProps) => {
  const displayData = data.slice(0, 15)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Ranking por Vendas</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, displayData.length * 40)}>
        <BarChart data={displayData} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="funcionarioNome"
            tick={{ fontSize: 12 }}
            width={110}
          />
          <Tooltip
            formatter={(value: number) => [
              'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              'Total Vendas',
            ]}
          />
          <Bar dataKey="totalVendas" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SalesRanking
