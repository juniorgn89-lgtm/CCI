import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts'
import { Activity, Gauge, Fuel, Award } from 'lucide-react'
import { CHART_COLORS } from '@/lib/constants'
import { formatNumber, formatCurrencyTooltip } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { MergedFrentista } from '@/pages/Operacao/components/ProdutividadeTab'

interface PerformanceAtendimentoProps {
  data: MergedFrentista[]
}

const SCATTER_COLORS = ['#f59e0b', '#9ca3af', '#cd7f32', '#2563eb', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316']

const PerformanceAtendimento = ({ data }: PerformanceAtendimentoProps) => {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Nenhum dado de atendimento no período.
      </div>
    )
  }

  const totalAtendimentos = data.reduce((s, f) => s + f.atendimentos, 0)
  const totalLitros = data.reduce((s, f) => s + f.litrosVendidos, 0)
  const mediaGlobalLitros = totalAtendimentos > 0 ? totalLitros / totalAtendimentos : 0

  const sortedByEfficiency = [...data].sort((a, b) => b.mediaLitrosPorAtendimento - a.mediaLitrosPorAtendimento)
  const bestEfficiency = sortedByEfficiency[0]

  const sortedByAtendimentos = [...data].sort((a, b) => b.atendimentos - a.atendimentos)
  const mostAtendimentos = sortedByAtendimentos[0]

  const kpis = [
    { label: 'Média L/Atendimento', value: `${mediaGlobalLitros.toFixed(1)} L`, icon: Activity, color: 'text-emerald-600 dark:text-emerald-400', cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Maior Volume/Atend.', value: `${bestEfficiency.mediaLitrosPorAtendimento.toFixed(1)} L`, subtitle: bestEfficiency.nome, icon: Gauge, color: 'text-blue-600 dark:text-blue-400', cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Mais Atendimentos', value: formatNumber(mostAtendimentos.atendimentos), subtitle: mostAtendimentos.nome, icon: Award, color: 'text-amber-600 dark:text-amber-400', cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Total Atendimentos', value: formatNumber(totalAtendimentos), icon: Fuel, color: 'text-purple-600 dark:text-purple-400', cardBg: 'bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
  ]

  const top10Efficiency = sortedByEfficiency.slice(0, 10)
  const top10Atendimentos = sortedByAtendimentos.slice(0, 10)

  // Scatter data: x = atendimentos, y = litros/atendimento, z = faturamento
  const scatterData = data.map((f) => ({
    nome: f.nome,
    atendimentos: f.atendimentos,
    eficiencia: f.mediaLitrosPorAtendimento,
    faturamento: f.faturamento,
  }))

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className={cn('rounded-lg border border-gray-200/60 px-3 py-2.5 shadow-sm dark:border-gray-700/60', kpi.cardBg)}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{kpi.label}</p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', kpi.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', kpi.color)} />
                </div>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{kpi.value}</p>
              {'subtitle' in kpi && kpi.subtitle && (
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Scatter chart: Volume x Efficiency */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Volume vs Eficiência</h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Cada ponto representa um frentista. Eixo X = atendimentos, Eixo Y = litros/atendimento.
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis
              type="number"
              dataKey="atendimentos"
              name="Atendimentos"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Atendimentos', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#9ca3af' }}
            />
            <YAxis
              type="number"
              dataKey="eficiencia"
              name="L/Atendimento"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'L/Atendimento', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9ca3af' }}
            />
            <ZAxis type="number" dataKey="faturamento" range={[60, 400]} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              formatter={((v: number, name: string) => {
                if (name === 'Atendimentos') return [formatNumber(v), name]
                if (name === 'L/Atendimento') return [`${v.toFixed(1)} L`, name]
                return [formatCurrencyTooltip(v), 'Faturamento']
              }) as never}
              labelFormatter={(_, payload) => {
                if (payload?.[0]?.payload?.nome) return payload[0].payload.nome
                return ''
              }}
            />
            <Scatter data={scatterData} name="Frentistas">
              {scatterData.map((_, i) => (
                <Cell key={i} fill={SCATTER_COLORS[i % SCATTER_COLORS.length]} fillOpacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Efficiency ranking */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Litros/Atendimento por Frentista</h3>
          <ResponsiveContainer width="100%" height={Math.max(280, top10Efficiency.length * 36)}>
            <BarChart data={top10Efficiency} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(0)} L`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number) => [`${v.toFixed(1)} L`, 'L/Atendimento']) as never}
              />
              <Bar dataKey="mediaLitrosPorAtendimento" name="L/Atend." fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Atendimentos ranking */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Atendimentos por Frentista</h3>
          <ResponsiveContainer width="100%" height={Math.max(280, top10Atendimentos.length * 36)}>
            <BarChart data={top10Atendimentos} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number) => [formatNumber(v), 'Atendimentos']) as never}
              />
              <Bar dataKey="atendimentos" name="Atendimentos" fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default PerformanceAtendimento
