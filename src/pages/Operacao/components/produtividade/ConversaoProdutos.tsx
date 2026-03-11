import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import { TrendingUp, Target, Award, Users } from 'lucide-react'
import { CHART_COLORS } from '@/lib/constants'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { RankingRow } from '@/pages/Operacao/hooks/useProductivityData'

interface ConversaoProdutosProps {
  conversionRanking: RankingRow[]
}

const DONUT_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#2563eb']
const FAIXA_LABELS = ['0-25%', '25-50%', '50-75%', '75-100%']

const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#cd7f32']

const ConversaoProdutos = ({ conversionRanking }: ConversaoProdutosProps) => {
  if (conversionRanking.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Sem dados de conversão no período. Os dados de conversão são obtidos do placar de vendas.
      </div>
    )
  }

  const avgConversao = conversionRanking.reduce((s, r) => s + r.taxaConversao, 0) / conversionRanking.length
  const bestConversao = conversionRanking[0]
  const acima50 = conversionRanking.filter((r) => r.taxaConversao >= 50).length

  // Distribution by conversion range
  const faixas = [0, 0, 0, 0]
  for (const r of conversionRanking) {
    if (r.taxaConversao < 25) faixas[0]++
    else if (r.taxaConversao < 50) faixas[1]++
    else if (r.taxaConversao < 75) faixas[2]++
    else faixas[3]++
  }
  const donutData = faixas
    .map((count, i) => ({ name: FAIXA_LABELS[i], value: count }))
    .filter((d) => d.value > 0)

  const top15 = conversionRanking.slice(0, 15)

  const kpis = [
    { label: 'Conversão Média', value: `${avgConversao.toFixed(1)}%`, icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-l-blue-500' },
    { label: 'Melhor Conversão', value: `${bestConversao.taxaConversao.toFixed(1)}%`, subtitle: bestConversao.funcionarioNome, icon: Award, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-l-amber-500' },
    { label: 'Conversão ≥ 50%', value: formatNumber(acima50), subtitle: `de ${conversionRanking.length} frentistas`, icon: Target, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-l-green-500' },
    { label: 'Total Avaliados', value: formatNumber(conversionRanking.length), icon: Users, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-l-purple-500' },
  ]

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className={cn('rounded-xl border-l-4 border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900', kpi.border)}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{kpi.label}</p>
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', kpi.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', kpi.color)} />
                </div>
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{kpi.value}</p>
              {'subtitle' in kpi && kpi.subtitle && (
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Conversion bar chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Conversão por Frentista</h3>
          <ResponsiveContainer width="100%" height={Math.max(300, top15.length * 40)}>
            <BarChart data={top15} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 'auto']}
              />
              <YAxis type="category" dataKey="funcionarioNome" width={120} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number) => [`${v.toFixed(1)}%`, 'Conversão']) as never}
              />
              <Bar dataKey="taxaConversao" radius={[0, 6, 6, 0]}>
                {top15.map((_, i) => (
                  <Cell key={i} fill={i < 3 ? MEDAL_COLORS[i] : CHART_COLORS[1]} fillOpacity={i < 3 ? 1 : 0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution donut */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Distribuição de Conversão</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                strokeWidth={0}
              >
                {donutData.map((entry) => {
                  const idx = FAIXA_LABELS.indexOf(entry.name)
                  return <Cell key={entry.name} fill={DONUT_COLORS[idx >= 0 ? idx : 0]} />
                })}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number, name: string) => [`${v} frentista${v !== 1 ? 's' : ''}`, name]) as never}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {donutData.map((d) => {
              const idx = FAIXA_LABELS.indexOf(d.name)
              const pct = conversionRanking.length > 0 ? (d.value / conversionRanking.length) * 100 : 0
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: DONUT_COLORS[idx >= 0 ? idx : 0] }} />
                  <span className="flex-1 text-xs text-gray-600 dark:text-gray-400">{d.name}</span>
                  <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{d.value} ({pct.toFixed(0)}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConversaoProdutos
