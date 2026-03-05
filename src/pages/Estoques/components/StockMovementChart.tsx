import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import type { MovementRow } from '@/pages/Estoques/hooks/useStockData'

interface StockMovementChartProps {
  data: MovementRow[]
}

const formatDate = (date: string) => {
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

const StockMovementChart = ({ data }: StockMovementChartProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Movimentação de Estoque</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="dataMovimento" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={formatDate}
            formatter={(value: number, name: string) => [
              value.toLocaleString('pt-BR'),
              name,
            ]}
          />
          <Legend />
          <Bar
            dataKey="quatidadeEstoque"
            name="Quantidade"
            fill={CHART_COLORS[1]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default StockMovementChart
