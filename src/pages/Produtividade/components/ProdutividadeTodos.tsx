import { useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Fuel, Wrench, Store, Globe, Users, Trophy, ShoppingBag, TrendingUp, TrendingDown,
  Target, Sparkles, Pencil, Check, X, Award, ArrowUpRight, ArrowDownRight, Lightbulb,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import useProdutividadeTodos, {
  type SegmentoResumo, type InsightTodos,
} from '@/pages/Produtividade/hooks/useProdutividadeTodos'

/* ─────────────────────────────────────────────────────────────
 * Card de segmento (grande). Global em navy; demais em branco/dark.
 * ───────────────────────────────────────────────────────────── */
interface SegCardProps {
  label: string
  Icon: typeof Fuel
  iconBg: string
  iconColor: string
  resumo: SegmentoResumo
  cmpLabel: string
  loading: boolean
  navy?: boolean
  /** Comparação com meta (só no card Global, quando há meta). */
  metaPct?: number | null
}

const SegCard = ({ label, Icon, iconBg, iconColor, resumo, cmpLabel, loading, navy, metaPct }: SegCardProps) => {
  const { faturamento, participacaoPct, variacaoPct } = resumo
  const positiva = (variacaoPct ?? 0) >= 0
  const Arrow = positiva ? TrendingUp : TrendingDown

  return (
    <div className={cn(
      'flex flex-col rounded-2xl border p-5 shadow-sm',
      navy
        ? 'border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f]'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', navy ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>{label}</p>
          <p className={cn('text-[11px] uppercase tracking-wide', navy ? 'text-white/60' : 'text-gray-500 dark:text-gray-400')}>Faturamento</p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', navy ? 'bg-white/15' : iconBg)}>
          <Icon className={cn('h-5 w-5', navy ? 'text-white/90' : iconColor)} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-9 w-36" />
      ) : (
        <p className={cn('mt-3 text-3xl font-bold tabular-nums', navy ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>
          {formatCurrencyInt(faturamento)}
        </p>
      )}

      {!loading && (
        <div className={cn('mt-auto space-y-2 border-t pt-3', navy ? 'border-white/15' : 'border-gray-100 dark:border-gray-800')}>
          {/* Participação (todos menos Global) ou meta (Global) */}
          {navy ? (
            metaPct != null ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-white/60">Meta atingida</span>
                <span className="font-semibold tabular-nums text-white">{metaPct.toFixed(0)}%</span>
              </div>
            ) : null
          ) : (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Participação</span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {participacaoPct.toFixed(0)}% do total
              </span>
            </div>
          )}

          {/* Tendência */}
          {variacaoPct != null ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={navy ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}>vs {cmpLabel}</span>
              <span className={cn(
                'flex items-center gap-1 font-semibold tabular-nums',
                navy
                  ? (positiva ? 'text-emerald-300' : 'text-red-300')
                  : (positiva ? 'text-green-500' : 'text-red-500'),
              )}>
                <Arrow className="h-3.5 w-3.5" />
                {positiva ? '+' : ''}{variacaoPct.toFixed(1).replace('.', ',')}%
              </span>
            </div>
          ) : (
            <p className={cn('text-[11px]', navy ? 'text-white/50' : 'text-gray-400 dark:text-gray-500')}>Sem comparativo</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Card de Equipe (grande, mesmo grid dos segmentos).
 * ───────────────────────────────────────────────────────────── */
interface EquipeBigCardProps {
  total: number
  frentistas: number
  vendedores: number
  loading: boolean
}

const EquipeBigCard = ({ total, frentistas, vendedores, loading }: EquipeBigCardProps) => (
  <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Equipe</p>
        <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Colaboradores</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <Users className="h-5 w-5 text-slate-600 dark:text-slate-300" />
      </div>
    </div>

    {loading ? (
      <Skeleton className="mt-4 h-9 w-20" />
    ) : (
      <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(total)}</p>
    )}

    {!loading && (
      <div className="mt-auto space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <Fuel className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Frentistas</span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(frentistas)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Vendedores</span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(vendedores)}</span>
        </div>
      </div>
    )}
  </div>
)

/* ─────────────────────────────────────────────────────────────
 * Cards de Destaque (3).
 * ───────────────────────────────────────────────────────────── */
interface HighlightCardProps {
  title: string
  Icon: typeof Trophy
  accent: string
  iconBg: string
  iconColor: string
  children: React.ReactNode
}

const HighlightCard = ({ title, Icon, accent, iconBg, iconColor, children }: HighlightCardProps) => (
  <div className={cn('rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900', accent)}>
    <div className="flex items-center gap-2">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
    </div>
    <div className="mt-3">{children}</div>
  </div>
)

const VarPill = ({ pct }: { pct: number }) => {
  const pos = pct >= 0
  const Arrow = pos ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
      pos
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    )}>
      <Arrow className="h-3 w-3" />
      {pos ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Card de Meta (manual, localStorage).
 * ───────────────────────────────────────────────────────────── */
interface MetaCardProps {
  meta: number | null
  realizado: number
  setMeta: (v: number | null) => void
  loading: boolean
}

const MetaCard = ({ meta, realizado, setMeta, loading }: MetaCardProps) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(meta != null ? String(meta) : '')
    setEditing(true)
  }
  const save = () => {
    const n = Number(draft.replace(/\./g, '').replace(',', '.'))
    setMeta(Number.isFinite(n) && n > 0 ? n : null)
    setEditing(false)
  }

  const pct = meta && meta > 0 ? (realizado / meta) * 100 : 0
  const atingida = pct >= 100

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Meta do período</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Definir meta"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              placeholder="0,00"
              className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm tabular-nums text-gray-900 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            type="button"
            onClick={save}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-700"
            aria-label="Salvar meta"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : meta == null ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={startEdit}
            className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Defina uma meta
          </button>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Valor manual — não há meta de faturamento na API.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Realizado</p>
              {loading ? (
                <Skeleton className="mt-0.5 h-6 w-24" />
              ) : (
                <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(realizado)}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Meta</p>
              <p className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(meta)}</p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  atingida ? 'bg-emerald-500' : 'bg-violet-500',
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className={cn(
                'text-xs font-semibold tabular-nums',
                atingida ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400',
              )}>
                {pct.toFixed(0)}%
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {atingida ? 'Meta atingida' : `Faltam ${formatCurrencyInt(Math.max(0, meta - realizado))}`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Card de Insights automáticos.
 * ───────────────────────────────────────────────────────────── */
const insightDot = (type: InsightTodos['type']): string =>
  type === 'positive' ? 'bg-emerald-500' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'

const InsightsCard = ({ insights }: { insights: InsightTodos[] }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Insights</p>
    </div>
    {insights.length === 0 ? (
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Sem insights para o período.</p>
    ) : (
      <ul className="mt-3 space-y-2.5">
        {insights.map((ins, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', insightDot(ins.type))} />
            <span className="text-sm leading-snug text-gray-700 dark:text-gray-300">{ins.text}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
)

/* ─────────────────────────────────────────────────────────────
 * Tooltip do gráfico de evolução.
 * ───────────────────────────────────────────────────────────── */
interface EvoTooltipPayload { name: string; value: number | null; color: string }
const EvoTooltip = ({ active, payload, label }: { active?: boolean; payload?: EvoTooltipPayload[]; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1 font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 dark:text-gray-400">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {p.value == null ? '—' : formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Componente principal — modo "Todos".
 * ───────────────────────────────────────────────────────────── */
const ProdutividadeTodos = () => {
  const data = useProdutividadeTodos()
  const {
    cmpLabel, global, combustivel, automotivos, conveniencia,
    totalColaboradores, qtdFrentistas, qtdVendedores,
    campeaoFrentista, campeaoVendedor, melhorSetor,
    evolucao, evolucaoSeries, evolucaoSemHistorico,
    insights, meta, setMeta, isLoading,
  } = data

  const metaPct = meta && meta > 0 ? (global.faturamento / meta) * 100 : null

  return (
    <div className="space-y-4">
      {/* ── 5 cards principais ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SegCard
          label="Global" Icon={Globe} navy
          iconBg="" iconColor=""
          resumo={global} cmpLabel={cmpLabel} loading={isLoading} metaPct={metaPct}
        />
        <SegCard
          label="Combustível" Icon={Fuel}
          iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
          resumo={combustivel} cmpLabel={cmpLabel} loading={isLoading}
        />
        <SegCard
          label="Automotivos" Icon={Wrench}
          iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400"
          resumo={automotivos} cmpLabel={cmpLabel} loading={isLoading}
        />
        <SegCard
          label="Conveniência" Icon={Store}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
          resumo={conveniencia} cmpLabel={cmpLabel} loading={isLoading}
        />
        <EquipeBigCard total={totalColaboradores} frentistas={qtdFrentistas} vendedores={qtdVendedores} loading={isLoading} />
      </div>

      {/* ── 3 cards de destaque ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Frentista campeão */}
        <HighlightCard
          title="Frentista campeão" Icon={Trophy}
          accent="border-blue-200 dark:border-blue-900/40"
          iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
        >
          {campeaoFrentista ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{campeaoFrentista.nome}</p>
                {campeaoFrentista.variacaoPct != null && <VarPill pct={campeaoFrentista.variacaoPct} />}
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(campeaoFrentista.faturamento)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatLiters(campeaoFrentista.litros)}</span>
              </div>
              {campeaoFrentista.prevNome && (
                <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  Mês anterior: <span className="font-medium text-gray-700 dark:text-gray-300">{campeaoFrentista.prevNome}</span> · {formatLiters(campeaoFrentista.prevLitros)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sem dados de frentistas no período.</p>
          )}
        </HighlightCard>

        {/* Vendedor campeão */}
        <HighlightCard
          title="Vendedor campeão" Icon={Award}
          accent="border-emerald-200 dark:border-emerald-900/40"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
        >
          {campeaoVendedor ? (
            <>
              <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{campeaoVendedor.nome}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(campeaoVendedor.itens)} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">itens</span></span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Ticket {formatCurrency(campeaoVendedor.ticketMedio)}</span>
              </div>
              {campeaoVendedor.prevNome && (
                <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  Mês anterior: <span className="font-medium text-gray-700 dark:text-gray-300">{campeaoVendedor.prevNome}</span> · {formatCurrencyInt(campeaoVendedor.prevFaturamento)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sem dados de vendedores no período.</p>
          )}
        </HighlightCard>

        {/* Melhor setor */}
        <HighlightCard
          title="Melhor setor" Icon={Sparkles}
          accent="border-violet-200 dark:border-violet-900/40"
          iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600 dark:text-violet-400"
        >
          {melhorSetor ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{melhorSetor.nome}</p>
                <VarPill pct={melhorSetor.variacaoPct} />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Maior evolução de faturamento vs {cmpLabel}.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sem comparativo disponível.</p>
          )}
        </HighlightCard>
      </div>

      {/* ── Gráfico de evolução + Meta + Insights ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Gráfico (ocupa 2 colunas no xl) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 xl:col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Evolução da Produtividade</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Faturamento por segmento — últimos 12 meses</p>
            </div>
          </div>

          {evolucaoSemHistorico.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
              {evolucaoSemHistorico.join(', ')} sem histórico mensal disponível — não plotado.
            </p>
          )}

          {evolucao.length === 0 || evolucaoSeries.length === 0 ? (
            <div className="mt-6 flex h-[260px] items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <p className="text-sm text-gray-400 dark:text-gray-500">Sem série mensal para o período.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={evolucao} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  {evolucaoSeries.map((s) => (
                    <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyInt(v)} width={70} />
                <Tooltip content={<EvoTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                {evolucaoSeries.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2.5}
                    fill={`url(#grad-${s.key})`}
                    connectNulls
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Meta + Insights empilhados */}
        <div className="space-y-4">
          <MetaCard meta={meta} realizado={global.faturamento} setMeta={setMeta} loading={isLoading} />
          <InsightsCard insights={insights} />
        </div>
      </div>
    </div>
  )
}

export default ProdutividadeTodos
