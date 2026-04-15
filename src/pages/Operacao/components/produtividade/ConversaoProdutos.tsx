import { useMemo } from 'react'
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
import { TrendingUp, Target, Award, Users, AlertTriangle } from 'lucide-react'
import { CHART_COLORS } from '@/lib/constants'
import { formatNumber, formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { RankingRow } from '@/pages/Operacao/hooks/useProductivityData'
import type { MergedFrentista } from '@/pages/Operacao/components/ProdutividadeTab'

interface ConversaoProdutosProps {
  conversionRanking: RankingRow[]
  mergedData: MergedFrentista[]
}

const DONUT_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#2563eb']
const FAIXA_LABELS = ['0-25%', '25-50%', '50-75%', '75-100%']
const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#cd7f32']

const ConversaoProdutos = ({ conversionRanking, mergedData }: ConversaoProdutosProps) => {
  const hasPlacar = conversionRanking.length > 0

  // Fallback: calculate estimated conversion from merged data
  const fallbackData = useMemo(() => {
    if (hasPlacar) return []
    if (mergedData.length === 0) return []

    // Estimate conversion: ticket medio relative to average as a proxy
    const avgTicket = mergedData.reduce((s, f) => s + f.ticketMedio, 0) / mergedData.length
    const avgLitros = mergedData.reduce((s, f) => s + f.mediaLitrosPorAtendimento, 0) / mergedData.length

    return mergedData
      .filter((f) => f.atendimentos > 0)
      .map((f) => {
        // Score based on: ticket medio performance + litros/atendimento performance
        const ticketScore = avgTicket > 0 ? Math.min((f.ticketMedio / avgTicket) * 50, 100) : 50
        const litrosScore = avgLitros > 0 ? Math.min((f.mediaLitrosPorAtendimento / avgLitros) * 50, 100) : 50
        const estimatedConversao = Math.min(Math.round((ticketScore + litrosScore) / 2), 100)

        return {
          funcionarioCodigo: f.funcionarioCodigo,
          funcionarioNome: f.nome,
          totalVendas: f.faturamento,
          quantidadeVendas: f.atendimentos,
          ticketMedio: f.ticketMedio,
          taxaConversao: estimatedConversao,
        } as RankingRow
      })
      .sort((a, b) => b.taxaConversao - a.taxaConversao)
  }, [hasPlacar, mergedData])

  const data = hasPlacar ? conversionRanking : fallbackData

  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Sem dados de conversão no período.
      </div>
    )
  }

  const avgConversao = data.reduce((s, r) => s + r.taxaConversao, 0) / data.length
  const bestConversao = data[0]
  const acima50 = data.filter((r) => r.taxaConversao >= 50).length

  // Distribution by conversion range
  const faixas = [0, 0, 0, 0]
  for (const r of data) {
    if (r.taxaConversao < 25) faixas[0]++
    else if (r.taxaConversao < 50) faixas[1]++
    else if (r.taxaConversao < 75) faixas[2]++
    else faixas[3]++
  }
  const donutData = faixas
    .map((count, i) => ({ name: FAIXA_LABELS[i], value: count }))
    .filter((d) => d.value > 0)

  const top15 = data.slice(0, 15)

  const kpis = [
    { label: 'Conversão Média', value: `${avgConversao.toFixed(1)}%`, icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Melhor Conversão', value: `${bestConversao.taxaConversao.toFixed(1)}%`, subtitle: bestConversao.funcionarioNome, icon: Award, color: 'text-amber-600 dark:text-amber-400', cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Conversão ≥ 50%', value: formatNumber(acima50), subtitle: `de ${data.length} frentistas`, icon: Target, color: 'text-green-600 dark:text-green-400', cardBg: 'bg-gradient-to-br from-green-50/60 to-white dark:from-green-950/20 dark:to-gray-900', iconBg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Total Avaliados', value: formatNumber(data.length), icon: Users, color: 'text-purple-600 dark:text-purple-400', cardBg: 'bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
  ]

  return (
    <div className="space-y-5">
      {/* Warning banner when using fallback */}
      {!hasPlacar && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-800/30 dark:bg-amber-900/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Placar de vendas não configurado neste posto
            </p>
            <p className="mt-0.5 text-[11px] text-amber-600/80 dark:text-amber-500/80">
              Os dados abaixo são uma estimativa calculada com base no ticket médio e litros por atendimento de cada frentista.
              Para dados precisos, configure o placar de vendas no sistema Quality.
            </p>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Conversion bar chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {hasPlacar ? 'Conversão por Frentista' : 'Estimativa de Conversão por Frentista'}
          </h3>
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
                formatter={((v: number, _: string, entry: { payload: RankingRow }) => {
                  const r = entry.payload
                  return [`${v.toFixed(1)}% · ${formatCurrency(r.totalVendas)} · ${formatNumber(r.quantidadeVendas)} vendas`, hasPlacar ? 'Conversão' : 'Estimativa']
                }) as never}
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
              const pct = data.length > 0 ? (d.value / data.length) * 100 : 0
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
