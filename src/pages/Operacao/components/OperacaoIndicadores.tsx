import { useMemo } from 'react'
import {
  Fuel, Receipt, Users, Gauge, Wallet, Clock,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber, formatLiters } from '@/lib/formatters'
import type { OperacaoKpiData, AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'

type TabKey = 'indicadores' | 'bombas' | 'abastecimentos' | 'caixa' | 'produtividade'

interface Props {
  kpis: OperacaoKpiData
  abastecimentoRows: AbastecimentoRow[]
  onNavigateTab: (tab: TabKey) => void
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

const OperacaoIndicadores = ({ kpis, abastecimentoRows, onNavigateTab }: Props) => {
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

    return { porHora, combustiveis }
  }, [abastecimentoRows])

  // KPIs secundários compactos (sem DeltaBadge) — os principais ficam globais acima das abas
  const secondaryKpiCards = [
    { label: 'Abastecimentos', value: formatNumber(kpis.totalAbastecimentos), icon: Fuel, color: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/30', tab: 'abastecimentos' as TabKey },
    { label: 'Ticket Médio', value: formatCurrency(kpis.ticketMedio), icon: Receipt, color: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/30', tab: 'abastecimentos' as TabKey },
    { label: 'Frentistas', value: formatNumber(kpis.frentistasAtivos), icon: Users, color: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/30', tab: 'produtividade' as TabKey },
    { label: 'Bombas Ativas', value: formatNumber(kpis.bombasAtivas), icon: Gauge, color: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', tab: 'bombas' as TabKey },
    { label: 'Caixas Abertos', value: formatNumber(kpis.caixasAbertos), icon: Wallet, color: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-100 dark:bg-orange-900/30', tab: 'caixa' as TabKey },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs secundários compactos */}
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
