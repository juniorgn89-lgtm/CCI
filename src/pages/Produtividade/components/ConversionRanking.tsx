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

interface ConversionRankingProps {
  data: RankingRow[]
}

const ConversionRanking = ({ data }: ConversionRankingProps) => {
  const displayData = data.slice(0, 15)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Ranking por Taxa de Conversão</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, displayData.length * 40)}>
        <BarChart data={displayData} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="funcionarioNome"
            tick={{ fontSize: 12 }}
            width={110}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa de Conversão']}
          />
          <Bar dataKey="taxaConversao" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ConversionRanking
