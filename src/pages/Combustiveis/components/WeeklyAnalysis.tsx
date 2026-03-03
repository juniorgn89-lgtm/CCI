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

interface WeeklyRow {
  dia: string
  litros: number
  faturamento: number
  mediaLitros: number
  mediaFaturamento: number
}

interface WeeklyAnalysisProps {
  data: WeeklyRow[]
}

const formatCurrencyShort = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`
  return `R$ ${value.toFixed(0)}`
}

const WeeklyAnalysis = ({ data }: WeeklyAnalysisProps) => {
  // Reorder: Monday–Sunday instead of Sunday–Saturday
  const reordered = [...data.slice(1), data[0]]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Análise Semanal</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={reordered}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, name: string) => [
              name.includes('Litros')
                ? value.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' L'
                : 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              name,
            ]}
          />
          <Legend />
          <Bar dataKey="mediaFaturamento" name="Média Faturamento" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
          <Bar dataKey="mediaLitros" name="Média Litros" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default WeeklyAnalysis
