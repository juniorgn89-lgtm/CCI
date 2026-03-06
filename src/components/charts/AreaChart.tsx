import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'

interface AreaSeries {
  dataKey: string
  name: string
  color?: string
  yAxisId?: string
}

interface AreaChartProps {
  data: Record<string, unknown>[]
  series: AreaSeries[]
  xDataKey: string
  xTickFormatter?: (value: string) => string
  yTickFormatter?: (value: number) => string
  yRightTickFormatter?: (value: number) => string
  tooltipFormatter?: (value: number, name: string) => [string, string]
  tooltipLabelFormatter?: (label: string) => string
  height?: number
  title?: string
  dualAxis?: boolean
}

const AreaChart = ({
  data,
  series,
  xDataKey,
  xTickFormatter,
  yTickFormatter,
  yRightTickFormatter,
  tooltipFormatter,
  tooltipLabelFormatter,
  height = 350,
  title,
  dualAxis = false,
}: AreaChartProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {title && <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={xDataKey}
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 12 }}
          />
          {dualAxis ? (
            <>
              <YAxis
                yAxisId="left"
                orientation="left"
                tickFormatter={yTickFormatter}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={yRightTickFormatter ?? yTickFormatter}
                tick={{ fontSize: 12 }}
              />
            </>
          ) : (
            <YAxis tickFormatter={yTickFormatter} tick={{ fontSize: 12 }} />
          )}
          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={tooltipLabelFormatter}
          />
          <Legend />
          {series.map((s, i) => (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.15}
              {...(dualAxis ? { yAxisId: s.yAxisId ?? (i === 0 ? 'left' : 'right') } : {})}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default AreaChart
