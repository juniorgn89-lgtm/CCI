import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { COLORS } from '@/lib/constants'
import { useChartTheme } from '@/lib/chartTheme'

const EXTENDED_COLORS = [
  ...CHART_COLORS,
  COLORS.positive,
  COLORS.warning,
  COLORS.negative,
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
]

interface PieChartProps {
  data: Record<string, unknown>[]
  dataKey: string
  nameKey: string
  tooltipFormatter?: (value: number, name: string) => [string, string]
  height?: number
  title?: string
  innerRadius?: number
  outerRadius?: number
}

const PieChart = ({
  data,
  dataKey,
  nameKey,
  tooltipFormatter,
  height = 350,
  title,
  innerRadius = 60,
  outerRadius = 120,
}: PieChartProps) => {
  const ct = useChartTheme()
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {title && <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            label={({ name, percent }) =>
              `${name}: ${((percent ?? 0) * 100).toFixed(2)}%`
            }
            labelLine={{ stroke: ct.axis, strokeWidth: 1 }}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={EXTENDED_COLORS[index % EXTENDED_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={tooltipFormatter as never} contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }} />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default PieChart
