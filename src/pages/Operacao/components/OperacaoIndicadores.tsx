import { useMemo } from 'react'
import {
  Fuel, Droplets, DollarSign, Receipt, Users, Gauge, Wallet, TrendingUp,
  Lightbulb, Clock,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import InsightBanner from '@/components/kpi/InsightBanner'
import type { OperacaoKpiData, FrentistaRow, AbastecimentoRow, CaixaResumo } from '@/pages/Operacao/hooks/useOperacaoData'

type TabKey = 'indicadores' | 'bombas' | 'abastecimentos' | 'caixa' | 'produtividade'
type InsightVariant = 'success' | 'warning' | 'motivate'

interface Props {
  kpis: OperacaoKpiData
  frentistaRows: FrentistaRow[]
  abastecimentoRows: AbastecimentoRow[]
  caixaResumo: CaixaResumo
  onNavigateTab: (tab: TabKey) => void
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

const OperacaoIndicadores = ({ kpis, frentistaRows, abastecimentoRows, caixaResumo, onNavigateTab }: Props) => {
  const computed = useMemo(() => {
    // Abastecimentos por hora
    const horaMap = new Map<number, { count: number; litros: number }>()
    for (const a of abastecimentoRows) {
      const hour = parseInt(a.dataHora?.substring(11, 13) || '0', 10)
      if (isNaN(hour)) continue
      const prev = horaMap.get(hour) ?? { count: 0, litros: 0 }
      horaMap.set(hour, { count: prev.count + 1, litros: prev.litros + a.litros })
    }
    const porHora = Array.from({ length: 24 }, (_, h) => ({
      hora: `${String(h).padStart(2, '0')}h`,
      abastecimentos: horaMap.get(h)?.count ?? 0,
      litros: horaMap.get(h)?.litros ?? 0,
    })).filter((h) => h.abastecimentos > 0)

    const horaPico = porHora.reduce((max, h) => h.abastecimentos > max.abastecimentos ? h : max, porHora[0])

    // Combustíveis breakdown
    const combMap = new Map<string, { litros: number; valor: number; count: number }>()
    for (const a of abastecimentoRows) {
      const nome = a.produtoNome
      const prev = combMap.get(nome) ?? { litros: 0, valor: 0, count: 0 }
      combMap.set(nome, { litros: prev.litros + a.litros, valor: prev.valor + a.valorTotal, count: prev.count + 1 })
    }
    const combustiveis = Array.from(combMap.entries())
      .map(([nome, d]) => ({ nome, ...d }))
      .sort((a, b) => b.litros - a.litros)

    // Insights — apenas os 3 mais relevantes
    const insights: { variant: InsightVariant; text: string }[] = []

    // 1) Líder de vendas (frentista)
    const leader = frentistaRows[0]
    if (leader) {
      insights.push({
        variant: 'success',
        text: `${leader.nome} lidera com ${formatLiters(leader.litrosVendidos)} e ${leader.atendimentos} atendimentos`,
      })
    }

    // 2) Diferença de caixa
    if (caixaResumo.totalDiferenca < -100) {
      insights.push({
        variant: 'warning',
        text: `Diferença negativa no caixa: ${formatCurrency(caixaResumo.totalDiferenca)}. Verifique os turnos.`,
      })
    } else if (caixaResumo.totalDiferenca > 0) {
      insights.push({
        variant: 'success',
        text: `Caixa com diferença positiva de ${formatCurrency(caixaResumo.totalDiferenca)}`,
      })
    }

    // 3) Horário de pico
    if (horaPico) {
      insights.push({
        variant: 'motivate',
        text: `Horário de pico: ${horaPico.hora} com ${horaPico.abastecimentos} abastecimentos`,
      })
    }

    return { porHora, combustiveis, insights }
  }, [abastecimentoRows, frentistaRows, caixaResumo])

  // Linha 1 — KPIs principais com DeltaBadge (3 cards de destaque)
  const mainKpiCards = [
    {
      label: 'Litros Vendidos',
      value: formatLiters(kpis.totalLitros),
      icon: Droplets,
      color: 'text-blue-600 dark:text-blue-400',
      cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/30 dark:to-gray-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      tab: 'abastecimentos' as TabKey,
      current: kpis.totalLitros,
      previous: kpis.prevTotalLitros,
      formatter: formatLiters,
    },
    {
      label: 'Faturamento',
      value: formatCurrency(kpis.faturamentoCombustivel),
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      cardBg: 'bg-gradient-to-br from-green-50/60 to-white dark:from-green-950/30 dark:to-gray-900',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      tab: 'caixa' as TabKey,
      current: kpis.faturamentoCombustivel,
      previous: kpis.prevFaturamentoCombustivel,
      formatter: formatCurrency,
    },
    {
      label: 'Total Apurado',
      value: formatCurrency(kpis.totalApurado),
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/30 dark:to-gray-900',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      tab: 'caixa' as TabKey,
      current: kpis.totalApurado,
      previous: kpis.prevTotalApurado,
      formatter: formatCurrency,
    },
  ]

  // Linha 2 — KPIs secundários compactos (sem DeltaBadge)
  const secondaryKpiCards = [
    { label: 'Abastecimentos', value: formatNumber(kpis.totalAbastecimentos), icon: Fuel, color: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/30', tab: 'abastecimentos' as TabKey },
    { label: 'Ticket Médio', value: formatCurrency(kpis.ticketMedio), icon: Receipt, color: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/30', tab: 'abastecimentos' as TabKey },
    { label: 'Frentistas', value: formatNumber(kpis.frentistasAtivos), icon: Users, color: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/30', tab: 'produtividade' as TabKey },
    { label: 'Bombas Ativas', value: formatNumber(kpis.bombasAtivas), icon: Gauge, color: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', tab: 'bombas' as TabKey },
    { label: 'Caixas Abertos', value: formatNumber(kpis.caixasAbertos), icon: Wallet, color: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-100 dark:bg-orange-900/30', tab: 'caixa' as TabKey },
  ]

  return (
    <div className="space-y-6">
      {/* Linha 1 — KPIs principais (destaque máximo) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {mainKpiCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => onNavigateTab(card.tab)}
              className={cn(
                'rounded-xl border border-gray-200/60 px-5 py-6 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700/60',
                card.cardBg,
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', card.iconBg)}>
                  <Icon className={cn('h-5 w-5', card.color)} />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
              <DeltaBadge current={card.current} previous={card.previous} />
            </button>
          )
        })}
      </div>

      {/* Linha 2 — KPIs secundários compactos */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {secondaryKpiCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => onNavigateTab(card.tab)}
              className="rounded-lg border border-gray-200/60 bg-gray-50/50 px-3 py-3 text-left shadow-sm transition-all hover:shadow-md hover:bg-white dark:border-gray-700/60 dark:bg-gray-800/40 dark:hover:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', card.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', card.color)} />
                </div>
              </div>
              <p className="mt-1 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
            </button>
          )
        })}
      </div>

      {/* Insights — 3 mais relevantes em uma linha */}
      {computed.insights.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Insights da Operação</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            {computed.insights.map((ins, i) => (
              <InsightBanner key={i} type={ins.variant} message={ins.text} />
            ))}
          </div>
        </div>
      )}

      {/* Gráficos lado a lado, mais altos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Abastecimentos por hora */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Clock className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Abastecimentos por Hora
          </h3>
          {computed.porHora.length === 0 ? (
            <div className="flex h-80 items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={computed.porHora} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={((v: number, name: string) => [formatNumber(v), name === 'abastecimentos' ? 'Abastecimentos' : 'Litros']) as never}
                />
                <Bar dataKey="abastecimentos" name="Abastecimentos" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Combustíveis (donut) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Fuel className="mr-1.5 inline h-4 w-4 text-green-500" />
            Mix de Combustíveis
          </h3>
          {computed.combustiveis.length === 0 ? (
            <div className="flex h-80 items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div className="flex h-80 items-center gap-4">
              <div className="w-[220px] shrink-0">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={computed.combustiveis} dataKey="litros" nameKey="nome" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} strokeWidth={0}>
                      {computed.combustiveis.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      formatter={((v: number) => [formatLiters(v), 'Litros']) as never}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {computed.combustiveis.map((c, i) => {
                  const totalL = computed.combustiveis.reduce((s, x) => s + x.litros, 0)
                  const pct = totalL > 0 ? (c.litros / totalL) * 100 : 0
                  return (
                    <div key={c.nome} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{c.nome}</span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct.toFixed(1)}%</span>
                        </div>
                        <p className="text-[10px] tabular-nums text-gray-400">{formatLiters(c.litros)} &middot; {formatCurrency(c.valor)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OperacaoIndicadores
