import { useMemo } from 'react'
import {
  Fuel, Droplets, DollarSign, Receipt, Users, Gauge, Wallet, TrendingUp,
  Trophy, AlertTriangle, Lightbulb, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip, formatNumber, formatLiters } from '@/lib/formatters'
import type { OperacaoKpiData, FrentistaRow, BombaRow, AbastecimentoRow, TurnoRow, CaixaResumo } from '@/pages/Operacao/hooks/useOperacaoData'

type TabKey = 'indicadores' | 'bombas' | 'abastecimentos' | 'caixa' | 'produtividade'

interface Props {
  kpis: OperacaoKpiData
  frentistaRows: FrentistaRow[]
  bombaRows: BombaRow[]
  abastecimentoRows: AbastecimentoRow[]
  turnoRows: TurnoRow[]
  caixaResumo: CaixaResumo
  onNavigateTab: (tab: TabKey) => void
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

const OperacaoIndicadores = ({ kpis, frentistaRows, bombaRows, abastecimentoRows, turnoRows, caixaResumo, onNavigateTab }: Props) => {
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

    // Top 5 frentistas
    const topFrentistas = frentistaRows.slice(0, 5)

    // Top 5 bombas
    const topBombas = bombaRows.slice(0, 5)

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

    // Insights
    const insights: { type: 'positive' | 'warning' | 'info'; text: string }[] = []

    if (horaPico) {
      insights.push({
        type: 'info',
        text: `Horário de pico: ${horaPico.hora} com ${horaPico.abastecimentos} abastecimentos`,
      })
    }

    if (topFrentistas.length > 0) {
      const best = topFrentistas[0]
      insights.push({
        type: 'positive',
        text: `${best.nome} lidera com ${formatLiters(best.litrosVendidos)} e ${best.atendimentos} atendimentos`,
      })
    }

    if (caixaResumo.totalDiferenca < -100) {
      insights.push({
        type: 'warning',
        text: `Diferença negativa no caixa: ${formatCurrency(caixaResumo.totalDiferenca)}. Verifique os turnos.`,
      })
    } else if (caixaResumo.totalDiferenca > 0) {
      insights.push({
        type: 'positive',
        text: `Caixa com diferença positiva de ${formatCurrency(caixaResumo.totalDiferenca)}`,
      })
    }

    if (caixaResumo.caixasAbertos > 0) {
      insights.push({
        type: 'info',
        text: `${caixaResumo.caixasAbertos} caixa${caixaResumo.caixasAbertos > 1 ? 's' : ''} aberto${caixaResumo.caixasAbertos > 1 ? 's' : ''} no momento`,
      })
    }

    const bombasSemUso = bombaRows.filter((b) => b.abastecimentos === 0)
    if (bombasSemUso.length > 0) {
      insights.push({
        type: 'warning',
        text: `${bombasSemUso.length} bomba${bombasSemUso.length > 1 ? 's' : ''} sem abastecimento no período`,
      })
    }

    // Ticket médio vs média geral
    if (kpis.totalAbastecimentos > 0 && kpis.frentistasAtivos > 0) {
      const mediaLitrosPorFrentista = kpis.totalLitros / kpis.frentistasAtivos
      insights.push({
        type: 'info',
        text: `Ticket médio de ${formatCurrency(kpis.ticketMedio)} com média de ${formatLiters(mediaLitrosPorFrentista)} por frentista`,
      })
    }

    // Eficiência do turno — turno com maior faturamento por hora
    const turnosFechados = turnoRows.filter((t) => t.fechado && t.abertura && t.fechamento)
    if (turnosFechados.length > 0) {
      const turnoEficiencia = turnosFechados.map((t) => {
        const [hA, mA] = t.abertura.split(':').map(Number)
        const [hF, mF] = t.fechamento.split(':').map(Number)
        let horas = (hF * 60 + mF - hA * 60 - mA) / 60
        if (horas <= 0) horas = 24 + horas // turno que cruza meia-noite
        return { nome: t.funcionarioNome, turno: t.turno, data: t.dataMovimento, faturamentoPorHora: horas > 0 ? t.apurado / horas : 0, horas }
      }).sort((a, b) => b.faturamentoPorHora - a.faturamentoPorHora)

      const melhor = turnoEficiencia[0]
      if (melhor && melhor.faturamentoPorHora > 0) {
        insights.push({
          type: 'positive',
          text: `Turno mais eficiente: ${melhor.nome} com ${formatCurrency(melhor.faturamentoPorHora)}/hora (${melhor.horas.toFixed(1)}h trabalhadas)`,
        })
      }
    }

    // Sort: positive first, then info, then warning
    const order = { positive: 0, info: 1, warning: 2 }
    insights.sort((a, b) => order[a.type] - order[b.type])

    return { porHora, topFrentistas, topBombas, combustiveis, insights }
  }, [abastecimentoRows, frentistaRows, bombaRows, turnoRows, caixaResumo, kpis])

  const kpiCards = [
    { label: 'Abastecimentos', value: formatNumber(kpis.totalAbastecimentos), icon: Fuel, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', tab: 'abastecimentos' as TabKey },
    { label: 'Litros Vendidos', value: formatLiters(kpis.totalLitros), icon: Droplets, color: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/30', tab: 'abastecimentos' as TabKey },
    { label: 'Faturamento', value: formatCurrency(kpis.faturamentoCombustivel), icon: DollarSign, color: 'text-green-600 dark:text-green-400', border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-900/30', tab: 'caixa' as TabKey },
    { label: 'Ticket Médio', value: formatCurrency(kpis.ticketMedio), icon: Receipt, color: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', tab: 'abastecimentos' as TabKey },
    { label: 'Frentistas', value: formatNumber(kpis.frentistasAtivos), icon: Users, color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', tab: 'produtividade' as TabKey },
    { label: 'Bombas Ativas', value: formatNumber(kpis.bombasAtivas), icon: Gauge, color: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30', tab: 'bombas' as TabKey },
    { label: 'Caixas Abertos', value: formatNumber(kpis.caixasAbertos), icon: Wallet, color: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30', tab: 'caixa' as TabKey },
    { label: 'Total Apurado', value: formatCurrency(kpis.totalApurado), icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', tab: 'caixa' as TabKey },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => onNavigateTab(card.tab)}
              className={cn('rounded-xl border-l-4 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:bg-gray-900', card.border)}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', card.bg)}>
                  <Icon className={cn('h-4 w-4', card.color)} />
                </div>
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{card.value}</p>
            </button>
          )
        })}
      </div>

      {/* Insights */}
      {computed.insights.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Insights da Operação</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {computed.insights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2',
                  ins.type === 'positive' && 'border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10',
                  ins.type === 'warning' && 'border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10',
                  ins.type === 'info' && 'border-blue-200 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-900/10',
                )}
              >
                {ins.type === 'positive' && <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />}
                {ins.type === 'warning' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                {ins.type === 'info' && <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
                <p className="text-xs text-gray-700 dark:text-gray-300">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Abastecimentos por hora */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Clock className="mr-1.5 inline h-4 w-4 text-blue-500" />
            Abastecimentos por Hora
          </h3>
          {computed.porHora.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
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
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Sem dados.</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-[160px] shrink-0">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={computed.combustiveis} dataKey="litros" nameKey="nome" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} strokeWidth={0}>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Frentistas */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Trophy className="mr-1.5 inline h-4 w-4 text-amber-500" />
              Top Frentistas
            </h3>
            <button onClick={() => onNavigateTab('produtividade')} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Ver todos
            </button>
          </div>
          {computed.topFrentistas.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {computed.topFrentistas.map((f, i) => {
                const maxLitros = computed.topFrentistas[0]?.litrosVendidos || 1
                const pct = (f.litrosVendidos / maxLitros) * 100
                return (
                  <div key={f.funcionarioCodigo} className="flex items-center gap-3">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      i === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                      i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm text-gray-900 dark:text-gray-100">{f.nome}</span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(f.litrosVendidos)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">{f.atendimentos} atend. &middot; {formatCurrency(f.faturamento)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Bombas */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Gauge className="mr-1.5 inline h-4 w-4 text-indigo-500" />
              Top Bombas
            </h3>
            <button onClick={() => onNavigateTab('bombas')} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Ver todas
            </button>
          </div>
          {computed.topBombas.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {computed.topBombas.map((b, i) => {
                const maxLitros = computed.topBombas[0]?.litrosVendidos || 1
                const pct = (b.litrosVendidos / maxLitros) * 100
                return (
                  <div key={b.bombaCodigo} className="flex items-center gap-3">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      i === 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm text-gray-900 dark:text-gray-100">{b.descricao}</span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(b.litrosVendidos)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                        {b.abastecimentos} abast. &middot; {formatCurrency(b.faturamento)}
                        {b.combustiveis.length > 0 && ` · ${b.combustiveis.join(', ')}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OperacaoIndicadores
