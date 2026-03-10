import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrencyShort, formatCurrencyTooltip, formatCurrency } from '@/lib/formatters'
import type { RankingRow } from '@/pages/Produtividade/hooks/useProductivityData'

interface SalesRankingProps {
  data: RankingRow[]
}

const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#cd7f32']

const SalesRanking = ({ data }: SalesRankingProps) => {
  const displayData = data.slice(0, 15)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ranking por Vendas</h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Top {displayData.length} vendedores por valor total vendido</p>
        </div>
        {data.length > 0 && (
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Lider</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(data[0].totalVendas)}</p>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(300, displayData.length * 40)}>
        <BarChart data={displayData} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis
            type="category"
            dataKey="funcionarioNome"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            width={110}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            formatter={((value: number) => [
              formatCurrencyTooltip(value),
              'Total Vendas',
            ]) as never}
          />
          <Bar dataKey="totalVendas" radius={[0, 6, 6, 0]}>
            {displayData.map((_, index) => (
              <Cell
                key={index}
                fill={index < 3 ? MEDAL_COLORS[index] : CHART_COLORS[1]}
                fillOpacity={index < 3 ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SalesRanking
