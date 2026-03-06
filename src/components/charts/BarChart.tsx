import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'

interface BarSeries {
  dataKey: string
  name: string
  color?: string
  stackId?: string
}

interface BarChartProps {
  data: Record<string, unknown>[]
  series: BarSeries[]
  xDataKey: string
  xTickFormatter?: (value: string) => string
  yTickFormatter?: (value: number) => string
  tooltipFormatter?: (value: number, name: string) => [string, string]
  tooltipLabelFormatter?: (label: string) => string
  height?: number
  title?: string
  xAngle?: number
  xHeight?: number
}

const BarChart = ({
  data,
  series,
  xDataKey,
  xTickFormatter,
  yTickFormatter,
  tooltipFormatter,
  tooltipLabelFormatter,
  height = 350,
  title,
  xAngle,
  xHeight,
}: BarChartProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {title && <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={xDataKey}
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 12 }}
            angle={xAngle}
            textAnchor={xAngle ? 'end' : 'middle'}
            height={xHeight}
          />
          <YAxis tickFormatter={yTickFormatter} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={tooltipFormatter as never}
            labelFormatter={tooltipLabelFormatter as never}
          />
          <Legend />
          {series.map((s, i) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              stackId={s.stackId}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default BarChart
