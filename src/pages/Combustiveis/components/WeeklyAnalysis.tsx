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
import { formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import type { WeeklyRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface WeeklyAnalysisProps {
  data: WeeklyRow[]
}

const WeeklyAnalysis = ({ data }: WeeklyAnalysisProps) => {
  const reordered = [...data.slice(1), data[0]]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Análise semanal</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Média de faturamento e litros por dia da semana</p>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={reordered}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
          <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            formatter={((value: number, name: string) => [
              name.includes('Litros')
                ? value.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' L'
                : formatCurrencyTooltip(value),
              name,
            ]) as never}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="mediaFaturamento" name="Média faturamento" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
          <Bar dataKey="mediaLitros" name="Média litros" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default WeeklyAnalysis
