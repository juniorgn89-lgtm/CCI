import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { ShieldCheck, AlertTriangle, Fuel, History, Info, LineChart as LineChartIcon, BarChart3, LayoutGrid, ListTree, ArrowRight } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import HeaderHint from '@/components/tables/HeaderHint'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilters } from '@/hooks/useFilters'
import { useChartTheme } from '@/lib/chartTheme'
import useComplianceMargens, {
  type CmpRow,
  type StatusFaixa,
  type HistIndicadores,
  type FuelDailyPoint,
} from '@/pages/Compliance/hooks/useComplianceMargens'
import useComplianceVisaoGeral, {
  type VisaoGeralCell,
} from '@/pages/Compliance/hooks/useComplianceVisaoGeral'

/* ─── Formatação ─── */

/** Preço unitário em R$/L com 3 casas (padrão de bomba). Ex.: "R$ 6,199". */
const formatPrecoLitro = (value: number): string =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

/** R$/L ou travessão quando null. */
const fmtOrDash = (value: number | null): string =>
  value === null ? '—' : formatPrecoLitro(value)

/** Percentual pt-BR com sinal. Ex.: "+12,50%". */
const formatPct = (v: number): string => {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${Math.abs(v).toFixed(2).replace('.', ',')}%`
}

const marginColor = (v: number): string => {
  if (v > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (v < 0) return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

/* ─── Status por faixa (chip) ─── */

const STATUS_META: Record<StatusFaixa, { label: string; cls: string }> = {
  verde: { label: 'Verde', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  amarelo: { label: 'Amarelo', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  laranja: { label: 'Laranja', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' },
  vermelho: { label: 'Vermelho', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
}

const StatusChip = ({ status, desvioPct }: { status: StatusFaixa; desvioPct: number | null }) => {
  const meta = STATUS_META[status]
  const d = desvioPct ?? 0
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', meta.cls)}>
      {meta.label} · {sign}{Math.abs(Math.round(d))}%
    </span>
  )
}

/* ─── Skeletons ─── */

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  </div>
)

/* ─── Estados vazios ─── */

const EmptyState = ({ icon: Icon, message }: { icon: typeof Fuel; message: string }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/40">
    <Icon className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
    <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
  </div>
)

/* ─── Célula de valor ou traço ─── */

const NullableCell = ({ value, render }: { value: number | null; render: (v: number) => string }) =>
  value === null ? <span className="text-gray-300 dark:text-gray-600">—</span> : <>{render(value)}</>

/* ─── Tabela 1 — CMP por combustível ─── */

const MutedDash = () => <span className="text-gray-300 dark:text-gray-600">—</span>

const CmpTable = ({ rows, umPosto }: { rows: CmpRow[]; umPosto: boolean }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <table className="w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-100 text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
          <HeaderHint label="Combustível" help="Produto marcado como combustível no cadastro (produto.combustivel)." align="left" />
          <HeaderHint label="Qtd comprada" help="Volume total comprado no período, somando os itens das notas de entrada (/COMPRA_ITEM)." sub="litros" />
          <HeaderHint label="Nº notas" help="Quantidade de notas de compra distintas (compraCodigo) no período." />
          <HeaderHint label="CMP" help="Custo médio ponderado = Σ(quantidade × preço de custo) ÷ Σ(quantidade). Nunca só o último preço." sub="R$/L" groupStart />
          <HeaderHint label="Placa vigente" help="Preço à vista (coluna A) da troca de preço realizada mais recente no período. Provável placa à vista — confirmar com o WebPosto." sub="R$/L · col. A" />
          <HeaderHint label="Margem regulatória" help="Placa vigente − CMP. Margem SEM promoções/descontos — não é a margem operacional." sub="R$/L" groupStart />
          <HeaderHint label="Margem %" help="Margem regulatória ÷ placa vigente × 100." />
          <HeaderHint label="Status" help="Desvio da margem ATUAL vs. a MÉDIA das trocas do período. Faixas fixas (Fase 1): |desvio| < 20% Verde · 20–40% Amarelo · 40–70% Laranja · > 70% Vermelho. Configurável na Fase 2." align="center" groupStart />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((r) => (
          <tr key={r.produtoCodigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className="px-3 py-2.5 text-left font-medium text-gray-800 dark:text-gray-200">
              <span className="inline-flex items-center gap-2">
                <Fuel className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                {r.nome}
              </span>
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {r.qtdComprada > 0 ? formatLiters(r.qtdComprada) : <span className="text-gray-300 dark:text-gray-600">—</span>}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {r.numNotas > 0 ? formatNumber(r.numNotas) : <span className="text-gray-300 dark:text-gray-600">—</span>}
            </td>
            <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
              <NullableCell value={r.cmp} render={formatPrecoLitro} />
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {!umPosto || r.placaVigente === null ? (
                <MutedDash />
              ) : (
                <span className="inline-flex items-center justify-end gap-1">
                  {formatPrecoLitro(r.placaVigente)}
                  {r.placaData && (
                    <InfoHint text={`Troca de preço de ${formatDate(r.placaData)}. Colunas B/C: ${r.placaB !== null ? formatPrecoLitro(r.placaB) : '—'} / ${r.placaC !== null ? formatPrecoLitro(r.placaC) : '—'}.`} />
                  )}
                </span>
              )}
            </td>
            <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums font-semibold dark:border-gray-700">
              {!umPosto || r.margemAbs === null ? (
                <MutedDash />
              ) : (
                <span className={marginColor(r.margemAbs)}>{formatPrecoLitro(r.margemAbs)}</span>
              )}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums font-medium">
              {!umPosto || r.margemPct === null ? (
                <MutedDash />
              ) : (
                <span className={marginColor(r.margemPct)}>{formatPct(r.margemPct)}</span>
              )}
            </td>
            <td className="border-l border-gray-200 px-3 py-2.5 text-center dark:border-gray-700">
              {!umPosto || r.statusFaixa === null ? (
                <MutedDash />
              ) : (
                <StatusChip status={r.statusFaixa} desvioPct={r.desvioPct} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

/* ─── Gráfico — Placa × Margem ao longo do período ─── */

const MargemChart = ({ serie }: { serie: CmpRow['serie'] }) => {
  const ct = useChartTheme()
  const data = serie.map((p) => ({ data: formatDate(p.data), placa: p.placa, margem: p.margem }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} strokeOpacity={0.5} />
        <XAxis dataKey="data" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
        <YAxis
          width={82}
          tick={{ fontSize: 10, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatPrecoLitro(v)}
        />
        <Tooltip
          formatter={((value: number | null, name: string) =>
            [value == null ? '—' : formatPrecoLitro(value), name]) as never}
          contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Line
          type="stepAfter"
          dataKey="placa"
          name="Placa (R$/L)"
          stroke={ct.accent}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="stepAfter"
          dataKey="margem"
          name="Margem (R$/L)"
          stroke="#d97706"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#d97706' }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ─── Seção do gráfico (só com 1 posto) ─── */

const MargemChartSection = ({ rows }: { rows: CmpRow[] }) => {
  // Combustíveis "graficáveis": ≥2 pontos de troca no período.
  const chartRows = useMemo(() => rows.filter((r) => r.serie.length >= 2), [rows])
  const [selected, setSelected] = useState<number | null>(null)
  // Default = combustível com mais litros (rows já vem ordenada por qtdComprada).
  // Deriva sem effect: cai no 1º elegível quando a seleção some por filtro.
  const active = selected !== null && chartRows.some((r) => r.produtoCodigo === selected)
    ? selected
    : chartRows[0]?.produtoCodigo ?? null
  const activeRow = chartRows.find((r) => r.produtoCodigo === active) ?? null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <LineChartIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Placa × margem ao longo do período</h2>
        <InfoHint text="Evolução do preço de placa (à vista) e da margem regulatória (placa − CMP) a cada troca de preço do período. A margem usa o CMP ponderado do período como custo de referência." />
      </div>

      {chartRows.length === 0 || activeRow === null ? (
        <EmptyState
          icon={LineChartIcon}
          message="Poucas trocas de preço no período — o gráfico precisa de pelo menos 2 pontos por combustível."
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {/* Seletor de combustível (chips) */}
          <div className="mb-4 flex flex-wrap gap-2">
            {chartRows.map((r) => (
              <button
                key={r.produtoCodigo}
                type="button"
                onClick={() => setSelected(r.produtoCodigo)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  r.produtoCodigo === active
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-500 dark:bg-blue-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60',
                )}
              >
                <Fuel className="h-3.5 w-3.5 shrink-0" />
                {r.nome}
              </button>
            ))}
          </div>
          <MargemChart serie={activeRow.serie} />
        </div>
      )}
    </section>
  )
}

/* ─── Indicadores históricos (365 dias) — só com 1 posto ─── */

/** Item do painel de indicadores (rótulo + valor + hint opcional). */
const StatItem = ({
  label, value, hint, valueClass,
}: { label: string; value: string; hint?: string; valueClass?: string }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40">
    <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
      {hint && <InfoHint text={hint} />}
    </p>
    <p className={cn('mt-0.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100', valueClass)}>
      {value}
    </p>
  </div>
)

/** Gráfico — margem diária + médias móveis 30/90 sobre os últimos 365 dias. */
const HistMargemChart = ({ daily }: { daily: FuelDailyPoint[] }) => {
  const ct = useChartTheme()
  const data = daily.map((p) => ({ data: p.data, margem: p.margem, mm30: p.mm30, mm90: p.mm90 }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} strokeOpacity={0.5} />
        <XAxis
          dataKey="data"
          tick={{ fontSize: 10, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
          tickFormatter={(v: string) => formatDate(v)}
        />
        <YAxis
          width={82}
          tick={{ fontSize: 10, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatPrecoLitro(v)}
        />
        <Tooltip
          labelFormatter={((v: string) => formatDate(v)) as never}
          formatter={((value: number | null, name: string) =>
            [value == null ? '—' : formatPrecoLitro(value), name]) as never}
          contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Line type="monotone" dataKey="margem" name="Margem diária" stroke="#d97706" strokeWidth={1.5} dot={false} connectNulls />
        <Line type="monotone" dataKey="mm30" name="Média móvel 30d" stroke={ct.accent} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="mm90" name="Média móvel 90d" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

const HistIndicadoresSection = ({ hist, isLoading }: { hist: HistIndicadores[]; isLoading: boolean }) => {
  const [selected, setSelected] = useState<number | null>(null)
  const active = selected !== null && hist.some((h) => h.produtoCodigo === selected)
    ? selected
    : hist[0]?.produtoCodigo ?? null
  const row = hist.find((h) => h.produtoCodigo === active) ?? null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Indicadores históricos (365 dias)</h2>
        <InfoHint text="Janela FIXA dos últimos 365 dias terminando na data final do filtro (independe do início do período selecionado). Margem diária = placa do dia − CMP diário (média ponderada das compras dos últimos 30 dias)." />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : hist.length === 0 || row === null ? (
        <EmptyState
          icon={BarChart3}
          message="A integração ainda não tem histórico de compras e trocas de preço para os últimos 365 dias deste posto. Os indicadores se preenchem conforme o dado acumula — nada a 'apurar' (isto vem direto da API, não do cache de apuração)."
        />
      ) : (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {/* Seletor de combustível */}
          <div className="flex flex-wrap gap-2">
            {hist.map((h) => (
              <button
                key={h.produtoCodigo}
                type="button"
                onClick={() => setSelected(h.produtoCodigo)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  h.produtoCodigo === active
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-500 dark:bg-blue-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60',
                )}
              >
                <Fuel className="h-3.5 w-3.5 shrink-0" />
                {h.nome}
              </button>
            ))}
          </div>

          {/* Cobertura real do histórico — honestidade sobre quanto dado embasa
              as médias (menos de 365d enquanto a integração não fecha 1 ano). */}
          <p className={cn(
            'flex items-start gap-1.5 rounded-lg px-3 py-2 text-[12px]',
            row.coberturaDias >= 330
              ? 'bg-gray-50 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400'
              : 'border border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
          )}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Cobertura: <strong>{row.coberturaDias} {row.coberturaDias === 1 ? 'dia' : 'dias'}</strong> com dado real
              {row.desde && <> · desde <strong>{formatDate(row.desde)}</strong></>}.
              {row.coberturaDias < 330 && ' As médias de janelas maiores (180d/365d) e os percentis ainda são parciais — vão se completando conforme o histórico acumula.'}
            </span>
          </p>

          {/* Painel de indicadores */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <StatItem
              label="Margem atual"
              value={fmtOrDash(row.margemAtual)}
              hint="Margem regulatória (placa − CMP diário) do dia mais recente com dado disponível."
              valueClass={row.margemAtual !== null ? marginColor(row.margemAtual) : undefined}
            />
            <StatItem label="Média 30d" value={fmtOrDash(row.mm30)} hint="Média das margens diárias dos últimos 30 dias." />
            <StatItem label="Média 90d" value={fmtOrDash(row.mm90)} hint="Média das margens diárias dos últimos 90 dias." />
            <StatItem label="Média 180d" value={fmtOrDash(row.mm180)} hint="Média das margens diárias dos últimos 180 dias." />
            <StatItem label="Média 365d" value={fmtOrDash(row.mm365)} hint="Média das margens diárias dos últimos 365 dias." />
            <StatItem label="Mediana" value={fmtOrDash(row.mediana)} hint="Mediana das margens diárias dos últimos 365 dias." />
            <StatItem label="P25" value={fmtOrDash(row.p25)} hint="Percentil 25 das margens diárias dos últimos 365 dias." />
            <StatItem label="P75" value={fmtOrDash(row.p75)} hint="Percentil 75 das margens diárias dos últimos 365 dias." />
            <StatItem label="Mínimo" value={fmtOrDash(row.minimo)} hint="Menor margem diária dos últimos 365 dias." />
            <StatItem label="Máximo" value={fmtOrDash(row.maximo)} hint="Maior margem diária dos últimos 365 dias." />
            <StatItem label="Desvio-padrão" value={fmtOrDash(row.desvioPadrao)} hint="Desvio-padrão populacional das margens diárias (dispersão)." />
            {/* Alerta histórico (vs média móvel 90d) */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Alerta
                <InfoHint text="Faixa pelo desvio da margem atual vs. a média móvel de 90 dias. Limites fixos: |desvio| < 20% Verde · 20–40% Amarelo · 40–70% Laranja · > 70% Vermelho." />
              </p>
              <div className="mt-1">
                {row.statusFaixaHist ? (
                  <StatusChip status={row.statusFaixaHist} desvioPct={row.desvioVsMM90} />
                ) : (
                  <MutedDash />
                )}
              </div>
            </div>
          </div>

          {/* Comparativos vs médias móveis */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100 text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
                  <th className="px-3 py-2 text-left font-medium">Comparativo</th>
                  <th className="px-3 py-2 text-right font-medium">Média · R$/L</th>
                  <th className="px-3 py-2 text-right font-medium">Diferença · R$/L</th>
                  <th className="px-3 py-2 text-right font-medium">Diferença %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {row.comparativos.map((c) => (
                  <tr key={c.janela} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">vs média {c.janela} dias</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      <NullableCell value={c.mm} render={formatPrecoLitro} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {c.difAbs === null ? <MutedDash /> : <span className={marginColor(c.difAbs)}>{formatPrecoLitro(c.difAbs)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {c.difPct === null ? <MutedDash /> : <span className={marginColor(c.difPct)}>{formatPct(c.difPct)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gráfico — margem diária + MM30 + MM90 */}
          <HistMargemChart daily={row.daily} />

          {/* Nota honesta da seção */}
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Janela dos <strong>últimos 365 dias</strong> (fixa — não é o período selecionado no topo). O{' '}
              <strong>CMP diário é a média ponderada das compras dos últimos 30 dias</strong> (modelo v1; o custo médio
              por estoque, com entrada/saída, é evolução futura). O <strong>alerta</strong> compara a margem atual com a{' '}
              <strong>média móvel de 90 dias</strong>, e os limites de faixa são fixos (20/40/70%, configuráveis na
              Fase 2). Não é veredito oficial da ANP.
            </span>
          </p>
        </div>
      )}
    </section>
  )
}

/* ─── Visão Geral (panorama por posto × combustível) ─── */

/** Célula da matriz: margem % tintada pela faixa + detalhe R$/L no InfoHint. */
const MatrixCell = ({ cell }: { cell: VisaoGeralCell | undefined }) => {
  if (!cell || cell.margem === null || cell.status === null) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>
  }
  const meta = STATUS_META[cell.status]
  const principal = cell.margemPct !== null ? formatPct(cell.margemPct) : formatPrecoLitro(cell.margem)
  const detalhe = `Placa ${fmtOrDash(cell.placa)} − CMP ${fmtOrDash(cell.cmp)} = margem ${formatPrecoLitro(cell.margem)}/L`
    + (cell.margemPct !== null ? ` (${formatPct(cell.margemPct)})` : '')
  return (
    <span className="inline-flex items-center justify-center gap-1">
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', meta.cls)}>
        {principal}
      </span>
      <InfoHint text={detalhe} />
    </span>
  )
}

/** Chip de resumo por faixa (answer-first). */
const ResumoChip = ({ status, count }: { status: StatusFaixa; count: number }) => {
  const meta = STATUS_META[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums', meta.cls)}>
      <span className="tabular-nums">{count}</span>
      {meta.label}
    </span>
  )
}

const VisaoGeral = ({ onDrill }: { onDrill: (empresaCodigo: number) => void }) => {
  const { postos, fuels, resumo, isLoading, error } = useComplianceVisaoGeral()

  if (error) {
    return <EmptyState icon={AlertTriangle} message="Erro ao carregar os dados de compra e troca de preço. Tente atualizar." />
  }
  if (isLoading) return <TableSkeleton />
  if (postos.length === 0 || fuels.length === 0) {
    return <EmptyState icon={LayoutGrid} message="Sem compras de combustível nem trocas de preço no período/escopo selecionado." />
  }

  return (
    <div className="space-y-4">
      {/* Resumo — contagem por faixa, do pior pro melhor. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Panorama ({resumo.total} {resumo.total === 1 ? 'célula' : 'células'})
        </span>
        {resumo.total === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500">Sem margem computável (falta placa ou custo no período).</span>
        ) : (
          <>
            <ResumoChip status="vermelho" count={resumo.vermelho} />
            <ResumoChip status="laranja" count={resumo.laranja} />
            <ResumoChip status="amarelo" count={resumo.amarelo} />
            <ResumoChip status="verde" count={resumo.verde} />
          </>
        )}
      </div>

      {/* Nota honesta. */}
      <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] leading-relaxed text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          O panorama usa o status do <strong>período selecionado</strong> (leve — margem atual vs. média das trocas do
          período). O <strong>alerta histórico de 365 dias</strong> fica no <strong>Detalhe</strong> de cada posto
          (clique no nome). Uma cor aqui NÃO é veredito oficial da ANP.
        </span>
      </p>

      {/* Matriz posto × combustível. */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-100 text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
              <th className="px-3 py-2.5 text-left font-medium">Posto</th>
              {fuels.map((f) => (
                <th key={f.produtoCodigo} className="px-3 py-2.5 text-center font-medium">{f.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {postos.map((p) => (
              <tr key={p.empresaCodigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-3 py-2.5 text-left">
                  <button
                    type="button"
                    onClick={() => onDrill(p.empresaCodigo)}
                    className="group inline-flex items-center gap-1.5 font-medium text-gray-800 transition-colors hover:text-[#1e3a5f] dark:text-gray-200 dark:hover:text-blue-400"
                    title="Abrir o detalhe deste posto"
                  >
                    {p.nome}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-colors group-hover:text-[#1e3a5f] dark:text-gray-600 dark:group-hover:text-blue-400" />
                  </button>
                </td>
                {fuels.map((f) => (
                  <td key={f.produtoCodigo} className="px-3 py-2.5 text-center">
                    <MatrixCell cell={p.fuels.get(f.produtoCodigo)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        <ArrowRight className="h-3 w-3 shrink-0" />
        Clique no nome do posto para abrir o Detalhe (placa, margem e alerta histórico de 365 dias).
      </p>
    </div>
  )
}

/* ─── Página ─── */

type ComplianceTab = 'geral' | 'detalhe'

const TAB_META: { id: ComplianceTab; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'geral', label: 'Visão Geral', Icon: LayoutGrid },
  { id: 'detalhe', label: 'Detalhe', Icon: ListTree },
]

const Compliance = () => {
  const { cmpRows, trocaLog, histIndicadores, scopedCount, isLoading, isLoadingHist, error } = useComplianceMargens()
  // Placa (e portanto a margem) é POR POSTO — só faz sentido com 1 posto no
  // escopo. Em vários, a placa "mais recente" seria de um posto qualquer, então
  // escondemos placa/margem (mostra só o CMP, que é agregável).
  const umPosto = scopedCount === 1

  // Sub-aba local (não colide com deep-links de outros módulos). Panorama = default.
  const [tab, setTab] = useState<ComplianceTab>('geral')
  const { empresaCodigos, setEmpresas } = useFilters()
  // Guarda o filtro do topo de ANTES do drill, pra RESTAURAR ao voltar pra Visão
  // Geral — assim o panorama não fica preso no posto que você abriu.
  const filtroAntesDrill = useRef<number[] | null>(null)
  // Drill de um posto: fixa o filtro no posto e cai no Detalhe (placa+margem+365d).
  const openPosto = (empresaCodigo: number) => {
    if (filtroAntesDrill.current === null) filtroAntesDrill.current = empresaCodigos
    setEmpresas([empresaCodigo])
    setTab('detalhe')
  }
  // Ao voltar pra Visão Geral, devolve o filtro que estava antes do drill.
  const trocarAba = (id: ComplianceTab) => {
    if (id === 'geral' && filtroAntesDrill.current !== null) {
      setEmpresas(filtroAntesDrill.current)
      filtroAntesDrill.current = null
    }
    setTab(id)
  }
  // Sair do módulo com um posto drillado NÃO deve prender o filtro global nos
  // outros módulos — restaura na desmontagem se o drill não foi desfeito.
  useEffect(() => () => {
    if (filtroAntesDrill.current !== null) setEmpresas(filtroAntesDrill.current)
  }, [setEmpresas])

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
              Compliance ANP · Validação
            </h1>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Margem regulatória (placa − CMP) reconstruída de dados GET · spike
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Sub-abas — Panorama × Detalhe (filtro de período/empresa é compartilhado). */}
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
        {TAB_META.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => trocarAba(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
              tab === t.id
                ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            <t.Icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'geral' && <VisaoGeral onDrill={openPosto} />}

      {tab === 'detalhe' && (
      <>
      {/* Disclaimer honesto — spike de validação. */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="space-y-1 text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Validação / spike — não é número oficial ainda.</p>
            <p>
              Confirme com o WebPosto e crave qual coluna (A/B/C) é a placa à vista antes de tratar como
              oficial. A margem <strong>REGULATÓRIA</strong> (placa − CMP, sem promoções nem descontos)
              não é a mesma coisa que a margem <strong>operacional</strong> do dia a dia. O objetivo desta
              tela é reconciliar os números contra o ERP.
            </p>
            <p>
              O <strong>preço de placa é por posto</strong> — <strong>selecione um posto</strong> pra ver
              placa e margem. Com vários postos, mostramos só o CMP consolidado (a margem sairia
              enganosa, misturando a placa de um posto com o custo da rede).
            </p>
            <p>
              O <strong>Status</strong> desta tabela compara a margem atual com a <strong>média das trocas do
              período selecionado</strong> (a média histórica de 365 dias fica na seção{' '}
              <strong>Indicadores históricos</strong>, mais abaixo), e os <strong>limites de faixa são fixos</strong>{' '}
              (20/40/70%, configuráveis na Fase 2). O <strong>CMP é ponderado do período</strong> (não um custo
              diário por estoque). São escolhas de modelo v1 — uma cor aqui NÃO é veredito oficial da ANP.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <EmptyState icon={AlertTriangle} message="Erro ao carregar os dados de compra e troca de preço. Tente atualizar." />
      ) : (
        <>
          {/* Tabela 1 — CMP por combustível */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">CMP por combustível</h2>
              <InfoHint text="Custo médio ponderado das notas de compra do período × preço de placa vigente = margem regulatória prévia por produto." />
            </div>
            {!isLoading && !umPosto && cmpRows.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Vários postos no escopo — placa e margem estão ocultas (são por posto). Selecione um posto pra vê-las.
              </p>
            )}
            {isLoading ? (
              <TableSkeleton />
            ) : cmpRows.length === 0 ? (
              <EmptyState icon={Fuel} message="Sem compras de combustível nem trocas de preço no período/escopo selecionado." />
            ) : (
              <CmpTable rows={cmpRows} umPosto={umPosto} />
            )}
          </section>

          {/* Gráfico — Placa × Margem (só com 1 posto no escopo) */}
          {!isLoading && umPosto && cmpRows.length > 0 && <MargemChartSection rows={cmpRows} />}

          {/* Indicadores históricos 365d (só com 1 posto no escopo) */}
          {umPosto && <HistIndicadoresSection hist={histIndicadores} isLoading={isLoadingHist} />}

          {/* Tabela 2 — Log de troca de preço */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Log de troca de preço</h2>
              <InfoHint text="Trilha de auditoria (/TROCA_PRECO): cada alteração de preço realizada no período, do mais recente pro mais antigo." />
            </div>
            {isLoading ? (
              <TableSkeleton />
            ) : trocaLog.length === 0 ? (
              <EmptyState icon={History} message="Nenhuma troca de preço de combustível registrada no período/escopo selecionado." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100 text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
                      <HeaderHint label="Data / hora" help="Data e hora da troca de preço." align="left" />
                      <HeaderHint label="Combustível" help="Produto de combustível alterado." align="left" />
                      <HeaderHint label="Preço A" help="Preço à vista (coluna A) antes → depois da troca." sub="antigo → novo" groupStart />
                      <HeaderHint label="Custo no momento" help="Custo do produto registrado na troca de preço." sub="R$/L" groupStart />
                      <HeaderHint label="Markup %" help="Markup da coluna A registrado no momento da troca." />
                      <HeaderHint label="Turno" help="Turno em que a troca foi lançada." align="center" groupStart />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {trocaLog.map((r) => (
                      <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2.5 text-left tabular-nums text-gray-700 dark:text-gray-300">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{r.data ? formatDate(r.data) : '—'}</span>
                          {r.hora && <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{r.hora.slice(0, 5)}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-left font-medium text-gray-800 dark:text-gray-200">{r.nome}</td>
                        <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">
                          <span className="text-gray-400 line-through dark:text-gray-500">{formatPrecoLitro(r.precoA)}</span>
                          <span className={cn('ml-2 font-semibold', r.novoPrecoA >= r.precoA ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                            {formatPrecoLitro(r.novoPrecoA)}
                          </span>
                        </td>
                        <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">
                          {r.custo > 0 ? formatPrecoLitro(r.custo) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.percMarkupA ? `${r.percMarkupA.toFixed(2).replace('.', ',')}%` : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="border-l border-gray-200 px-3 py-2.5 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
                          {r.turno || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Rodapé de fonte */}
          <p className="flex items-center gap-1.5 pt-1 text-[11px] text-gray-400 dark:text-gray-500">
            <Info className="h-3 w-3 shrink-0" />
            Fonte: /COMPRA_ITEM + /TROCA_PRECO (GET). Read-only.
          </p>
        </>
      )}
      </>
      )}
    </div>
  )
}

export default Compliance
