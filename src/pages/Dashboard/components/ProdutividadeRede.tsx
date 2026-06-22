import { useMemo, useState } from 'react'
import {
  Network, Trophy, Gauge, TrendingDown, TrendingUp, Lightbulb, ArrowUp, ArrowDown, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatNumber, formatCurrency } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import EmptyState from '@/components/feedback/EmptyState'
import useProdutividadeRede, {
  type UnidadeProdutividade, type InsightRede,
} from '@/pages/Dashboard/hooks/useProdutividadeRede'

type SortMetric = 'prod' | 'faturamento' | 'litros'

/** Faturamento grande → "R$ 9,66 mi" / "R$ 740 mil". */
const fmtMi = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')} mi`
  if (Math.abs(v) >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return formatCurrencyInt(v)
}

/* ── Heatmap por rank de produtividade (terços: alta/média/baixa) ── */
const heatmapByRank = (rank: number, total: number): string => {
  if (total <= 0) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  const t = rank / total
  if (t <= 1 / 3) return 'bg-[#dcfce7] text-[#15803d] dark:bg-emerald-900/40 dark:text-emerald-300'
  if (t <= 2 / 3) return 'bg-[#fef9c3] text-[#a16207] dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-[#fee2e2] text-[#b91c1c] dark:bg-red-900/40 dark:text-red-300'
}

const RANK_CIRCLE = ['bg-[#1e3a5f]', 'bg-[#2563eb]', 'bg-[#60a5fa]'] // 1º, 2º, 3º
const BAR_PALETTE = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']

/* ── KPI card base ── */
const KpiBase = ({ navy, amber, children }: { navy?: boolean; amber?: boolean; children: React.ReactNode }) => (
  <div
    className={cn(
      'flex flex-col rounded-2xl border p-5 shadow-sm',
      navy
        ? 'border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f]'
        : amber
          ? 'border-[#fde68a] bg-white dark:border-amber-900/50 dark:bg-gray-900'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
    )}
  >
    {children}
  </div>
)

const Chip = ({ Icon, bg, color }: { Icon: typeof Network; bg: string; color: string }) => (
  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
    <Icon className={cn('h-5 w-5', color)} />
  </div>
)

/* ── Pill de variação (vs. período) ── */
const DeltaPill = ({ pct }: { pct: number | null }) => {
  if (pct === null) return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
  const pos = pct >= 0
  const Arrow = pos ? ArrowUp : ArrowDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
      pos
        ? 'bg-[#d1fae5] text-[#047857] dark:bg-emerald-900/40 dark:text-emerald-300'
        : 'bg-[#fee2e2] text-[#b91c1c] dark:bg-red-900/40 dark:text-red-300',
    )}>
      <Arrow className="h-3 w-3" />
      {pos ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%
    </span>
  )
}

/* ── Insights agrupados (padrão Positivos · Atenção · Informações) ── */
const INSIGHT_GROUPS: { type: InsightRede['type']; label: string; dot: string; text: string }[] = [
  { type: 'positive', label: 'Positivos', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'warning', label: 'Atenção', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { type: 'info', label: 'Informações', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
]

const InsightsCard = ({ insights }: { insights: InsightRede[] }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Insights</p>
      <InfoHint text="Leituras automáticas do período: destaques positivos, pontos de atenção e observações sobre o ranking de produtividade." />
    </div>
    {insights.length === 0 ? (
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Sem insights para o período.</p>
    ) : (
      <div className="mt-3 space-y-4">
        {INSIGHT_GROUPS.map((g) => {
          const items = insights.filter((ins) => ins.type === g.type)
          if (items.length === 0) return null
          return (
            <div key={g.type}>
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', g.dot)} />
                <p className={cn('text-[11px] font-semibold uppercase tracking-wide', g.text)}>{g.label}</p>
              </div>
              <ul className="mt-1.5 space-y-1.5 pl-3">
                {items.map((ins, i) => (
                  <li key={i} className="text-sm leading-snug text-gray-700 dark:text-gray-300">{ins.text}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    )}
  </div>
)

/* ── Botão de ordenação ── */
const SortBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200',
      active && 'text-gray-900 dark:text-gray-100',
    )}
  >
    {children}
    {active && <span className="text-[9px]">▼</span>}
  </button>
)

const metricValue = (u: UnidadeProdutividade, m: SortMetric): number =>
  m === 'faturamento' ? u.faturamento : m === 'litros' ? u.litros : u.prod

const metricFmt = (v: number, m: SortMetric): string => {
  if (m === 'litros') return `${formatNumber(v)} L`
  if (m === 'faturamento') return fmtMi(v)
  return `R$ ${Math.round(v / 1000)} mil`
}

/** ISO (UTC) → "DD/MM às HH:MM" no fuso local. */
const fmtApurado = (iso: string): string => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`
}

const ProdutividadeRede = () => {
  const data = useProdutividadeRede()
  const { unidades, faturamentoRede, colaboradoresRede, prodMedia, maisProdutiva, abaixoMedia, variacaoRedePct, cmpLabel, insights, apuradoAte, isLoading, hasData } = data
  const [sort, setSort] = useState<SortMetric>('prod')

  const sorted = useMemo(
    () => [...unidades].sort((a, b) => metricValue(b, sort) - metricValue(a, sort)),
    [unidades, sort],
  )
  const total = unidades.length
  const chartMax = Math.max(...sorted.map((u) => metricValue(u, sort)), 0)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
        <TableSkeleton rows={6} showHeader />
      </div>
    )
  }

  if (!hasData) {
    return (
      <EmptyState
        title="Sem dados de produtividade no período"
        description="Não há apuração para os postos no período selecionado. Selecione 2+ unidades e um período já apurado para comparar."
      />
    )
  }

  const abaixoPct = abaixoMedia && prodMedia > 0 ? (abaixoMedia.prod / prodMedia - 1) * 100 : null

  return (
    <div className="space-y-4">
      {/* Frescor: a apuração do dia corrente fecha ao longo do dia (cron). */}
      {apuradoAte && (
        <div className="flex justify-end">
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500"
            title="Os números vêm da apuração da rede. O dia corrente é re-apurado ao longo do dia, então pode ficar levemente atrás da tela de Vendas (ao vivo)."
          >
            <Clock className="h-3 w-3" />
            Apurado até {fmtApurado(apuradoAte)}
          </span>
        </div>
      )}

      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1 · Faturamento da rede (navy) */}
        <KpiBase navy>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-white">Faturamento da rede</p>
                <InfoHint text="Faturamento somado de todos os postos da rede no período · variação vs período comparativo." className="text-white/60 hover:text-white" />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Período atual</p>
            </div>
            <Chip Icon={Network} bg="bg-white/15" color="text-white/90" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">{fmtMi(faturamentoRede)}</p>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/15 pt-3">
            <span className="text-[11px] text-white/60">
              {total} {total === 1 ? 'unidade' : 'unidades'} · {formatNumber(colaboradoresRede)} colaboradores
            </span>
            {variacaoRedePct !== null && (
              <span className={cn(
                'flex items-center gap-1 text-xs font-semibold tabular-nums',
                variacaoRedePct >= 0 ? 'text-emerald-300' : 'text-red-300',
              )}>
                {variacaoRedePct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {variacaoRedePct >= 0 ? '+' : ''}{variacaoRedePct.toFixed(1).replace('.', ',')}%
              </span>
            )}
          </div>
        </KpiBase>

        {/* 2 · Mais produtiva */}
        <KpiBase>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Mais produtiva</p>
                <InfoHint text="Posto com maior faturamento por colaborador (faturamento ÷ equipe) no período." />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">R$ por colaborador</p>
            </div>
            <Chip Icon={Trophy} bg="bg-[#dbeafe] dark:bg-blue-900/30" color="text-[#2563eb] dark:text-blue-400" />
          </div>
          <p className="mt-3 truncate text-xl font-bold text-gray-900 dark:text-gray-100">{maisProdutiva?.nome ?? '—'}</p>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] text-gray-400">por colaborador</span>
            <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(maisProdutiva?.prod ?? 0)}</span>
          </div>
        </KpiBase>

        {/* 3 · Produtividade média */}
        <KpiBase>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Produtividade média</p>
                <InfoHint text="Produtividade média da rede = faturamento total ÷ total de colaboradores." />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Faturamento / colaborador</p>
            </div>
            <Chip Icon={Gauge} bg="bg-[#ede9fe] dark:bg-violet-900/30" color="text-[#7c3aed] dark:text-violet-400" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(prodMedia)}</p>
          <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] text-gray-400">média da rede no período</span>
          </div>
        </KpiBase>

        {/* 4 · Abaixo da média */}
        <KpiBase amber>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Abaixo da média</p>
                <InfoHint text="Posto com a menor produtividade (R$/colaborador) no período — % abaixo da média da rede." />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Requer atenção</p>
            </div>
            <Chip Icon={TrendingDown} bg="bg-[#fef3c7] dark:bg-amber-900/30" color="text-[#d97706] dark:text-amber-400" />
          </div>
          <p className="mt-3 truncate text-xl font-bold text-gray-900 dark:text-gray-100">{abaixoMedia?.nome ?? '—'}</p>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] tabular-nums text-gray-400">{formatCurrencyInt(abaixoMedia?.prod ?? 0)} / colab</span>
            {abaixoPct !== null && (
              <span className="text-sm font-bold tabular-nums text-[#b45309] dark:text-amber-400">
                {abaixoPct >= 0 ? '+' : ''}{abaixoPct.toFixed(0)}%
              </span>
            )}
          </div>
        </KpiBase>
      </div>

      {/* ── Ranking de unidades ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Ranking de unidades</h3>
              <InfoHint
                text="Compara todos os postos da rede no período — independe do posto selecionado no filtro global (que continua valendo nas outras abas da Central)."
                align="start"
              />
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Ordenado por {sort === 'prod' ? 'produtividade' : sort === 'faturamento' ? 'faturamento' : 'litros'} · todos os postos · período atual
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#dcfce7]" /> alta</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#fef9c3]" /> média</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#fee2e2]" /> baixa produtividade</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-100 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <th className="w-12 px-4 py-2.5 text-left font-semibold">#</th>
                <th className="px-4 py-2.5 text-left font-semibold">Unidade</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1"><SortBtn active={sort === 'faturamento'} onClick={() => setSort('faturamento')}>Faturamento</SortBtn><InfoHint text="Faturamento global do posto (combustível + loja) no período." /></span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1"><SortBtn active={sort === 'litros'} onClick={() => setSort('litros')}>Litros</SortBtn><InfoHint text="Litros de combustível vendidos no posto no período." /></span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1">Colab.<InfoHint text="Funcionários ativos do posto — denominador da produtividade (R$/colaborador)." /></span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1"><SortBtn active={sort === 'prod'} onClick={() => setSort('prod')}>R$ / colaborador</SortBtn><InfoHint text="Métrica-estrela = faturamento ÷ colaboradores. Cor pela faixa de produtividade (alta/média/baixa), fixa pelo ranking." /></span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1">Ticket médio<InfoHint text="Ticket médio do posto = faturamento ÷ itens vendidos." /></span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1">vs. {cmpLabel}<InfoHint text="Variação do faturamento do posto vs período comparativo." /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, i) => (
                <tr
                  key={u.empresaCodigo}
                  className={cn(
                    'border-t border-gray-100 transition-colors hover:bg-[#eff6ff] dark:border-gray-800 dark:hover:bg-blue-950/20',
                    i % 2 === 0 ? 'bg-[#f9fafb] dark:bg-gray-800/20' : 'bg-white dark:bg-transparent',
                  )}
                >
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      i < 3 ? cn(RANK_CIRCLE[i], 'text-white') : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                    )}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{u.nome}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(u.faturamento)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(u.litros)} L</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(u.colaboradores)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('inline-block min-w-[96px] rounded-md px-2.5 py-1 text-right font-bold tabular-nums', heatmapByRank(u.prodRank, total))}>
                      {formatCurrencyInt(u.prod)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(u.ticketMedio)}</td>
                  <td className="px-4 py-2.5 text-right"><DeltaPill pct={u.variacaoPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Gráfico + Insights ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* Gráfico de barras horizontais */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Produtividade por unidade</h3>
            <InfoHint text="Barras comparando os postos pela métrica de ordenação selecionada (produtividade, faturamento ou litros)." align="start" />
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Comparativo entre unidades · {sort === 'prod' ? 'produtividade' : sort === 'faturamento' ? 'faturamento' : 'litros'}
          </p>
          <div className="mt-4 space-y-2.5">
            {sorted.map((u, i) => {
              const v = metricValue(u, sort)
              const w = chartMax > 0 ? Math.max(2, (v / chartMax) * 100) : 0
              return (
                <div key={u.empresaCodigo} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs font-medium text-gray-700 dark:text-gray-300" title={u.nome}>{u.nome}</span>
                  <div className="h-[22px] flex-1 overflow-hidden rounded-md bg-[#f3f4f6] dark:bg-gray-800">
                    <div
                      className="h-full rounded-md"
                      style={{ width: `${w}%`, backgroundColor: BAR_PALETTE[Math.min(i, BAR_PALETTE.length - 1)] }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">{metricFmt(v, sort)}</span>
                </div>
              )
            })}
          </div>
        </div>

        <InsightsCard insights={insights} />
      </div>
    </div>
  )
}

export default ProdutividadeRede
