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
import { useChartTheme } from '@/lib/chartTheme'

interface HorizontalBarChartProps {
  data: Record<string, unknown>[]
  dataKey: string
  categoryKey: string
  name?: string
  color?: string
  xTickFormatter?: (value: number) => string
  tooltipFormatter?: (value: number, name: string) => [string, string]
  height?: number
  title?: string
  categoryWidth?: number
  maxItems?: number
}

const HorizontalBarChart = ({
  data,
  dataKey,
  categoryKey,
  name,
  color,
  xTickFormatter,
  tooltipFormatter,
  height,
  title,
  categoryWidth = 110,
  maxItems = 15,
}: HorizontalBarChartProps) => {
  const ct = useChartTheme()
  const displayData = data.slice(0, maxItems)
  const chartHeight = height ?? Math.max(300, displayData.length * 40)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {title && <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={displayData} layout="vertical" margin={{ left: categoryWidth + 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 12, fill: ct.axis }}
          />
          <YAxis
            type="category"
            dataKey={categoryKey}
            tick={{ fontSize: 12, fill: ct.axis }}
            width={categoryWidth}
          />
          <Tooltip formatter={tooltipFormatter as never} contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }} />
          <Bar
            dataKey={dataKey}
            name={name ?? dataKey}
            fill={color ?? CHART_COLORS[1]}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default HorizontalBarChart
