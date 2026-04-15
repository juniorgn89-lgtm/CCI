import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Droplets, Fuel, Activity, Receipt, DollarSign, Users } from 'lucide-react'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber, formatLiters, formatLitersShort } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { MergedFrentista } from '@/pages/Operacao/components/ProdutividadeTab'

interface IndicadoresProdutividadeProps {
  data: MergedFrentista[]
}

const IndicadoresProdutividade = ({ data }: IndicadoresProdutividadeProps) => {
  const totalLitros = data.reduce((s, f) => s + f.litrosVendidos, 0)
  const totalAtendimentos = data.reduce((s, f) => s + f.atendimentos, 0)
  const totalFaturamento = data.reduce((s, f) => s + f.faturamento, 0)
  const mediaLitrosAtendimento = totalAtendimentos > 0 ? totalLitros / totalAtendimentos : 0
  const ticketMedioGeral = totalAtendimentos > 0 ? totalFaturamento / totalAtendimentos : 0
  const frentistasAtivos = data.length

  const kpis = [
    { label: 'Total Litros', value: formatLiters(totalLitros), icon: Droplets, color: 'text-cyan-600 dark:text-cyan-400', cardBg: 'bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    { label: 'Total Abastecimentos', value: formatNumber(totalAtendimentos), icon: Fuel, color: 'text-blue-600 dark:text-blue-400', cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Média L/Atendimento', value: `${mediaLitrosAtendimento.toFixed(1)} L`, icon: Activity, color: 'text-emerald-600 dark:text-emerald-400', cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Ticket Médio Geral', value: formatCurrency(ticketMedioGeral), icon: Receipt, color: 'text-purple-600 dark:text-purple-400', cardBg: 'bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Total Faturamento', value: formatCurrency(totalFaturamento), icon: DollarSign, color: 'text-green-600 dark:text-green-400', cardBg: 'bg-gradient-to-br from-green-50/60 to-white dark:from-green-950/20 dark:to-gray-900', iconBg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Frentistas Ativos', value: formatNumber(frentistasAtivos), icon: Users, color: 'text-amber-600 dark:text-amber-400', cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
  ]

  const top10 = data.slice(0, 10)

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
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
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Litros por frentista */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Litros por Frentista</h3>
          {top10.length === 0 ? (
            <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, top10.length * 40)}>
              <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis type="number" tickFormatter={formatLitersShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={((v: number) => [formatLiters(v), 'Litros']) as never}
                />
                <Bar dataKey="litrosVendidos" name="Litros" fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Faturamento por frentista */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Faturamento por Frentista</h3>
          {top10.length === 0 ? (
            <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, top10.length * 40)}>
              <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis type="number" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={((v: number) => [formatCurrencyTooltip(v), 'Faturamento']) as never}
                />
                <Bar dataKey="faturamento" name="Faturamento" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Per-frentista breakdown cards */}
      {data.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Indicadores Individuais</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.slice(0, 12).map((f) => (
              <div key={f.funcionarioCodigo} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.nome}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Litros/Atend.</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {f.mediaLitrosPorAtendimento.toFixed(1)} L
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Ticket</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {formatCurrency(f.ticketMedio)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Litros</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {formatLiters(f.litrosVendidos)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Atend.</span>
                    <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                      {formatNumber(f.atendimentos)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default IndicadoresProdutividade
