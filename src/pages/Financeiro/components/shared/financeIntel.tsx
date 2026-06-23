import type { LucideIcon } from 'lucide-react'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { formatCurrency, formatCurrencyShort } from '@/lib/formatters'

/**
 * Blocos compartilhados das abas Receber e Pagar (Inteligência de cobrança/
 * pagamentos). O shell é o mesmo nas duas; a semântica (verde-receber ×
 * vermelho-pagar, cliente × fornecedor) entra por PROP (cor/rótulo), nunca por
 * `if` espalhado. Tudo apresentacional / read-only.
 */

const brDateFromIso = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')

/* ── Cabeçalho + botão Analisar ── */
export const IntelHeader = ({ title, actionLabel, open, onToggle, extra }: {
  title: string; actionLabel: string; open: boolean; onToggle: () => void
  /** Conteúdo opcional à esquerda (ex.: seletor de período da aba Cartões). */
  extra?: React.ReactNode
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      {extra}
    </div>
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
    >
      <Sparkles className="h-3.5 w-3.5" />{open ? 'Fechar análise' : actionLabel}
    </button>
  </div>
)

/* ── Painel de análise (insights + recomendação) ── */
export const AnalisePanel = ({ title, insights, recomendacao, onClose }: {
  title: string; insights: string[]; recomendacao: string; onClose: () => void
}) => (
  <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-gray-900">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />{title}
        <InfoHint text="Análise automática gerada por regras sobre os seus dados reais (não usa IA externa)." />
      </h3>
      <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-4 w-4" /></button>
    </div>
    <ul className="space-y-1.5">
      {insights.map((t, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />{t}
        </li>
      ))}
    </ul>
    <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-medium leading-relaxed text-indigo-900 shadow-sm dark:bg-gray-800/60 dark:text-indigo-200">{recomendacao}</p>
  </section>
)

/* ── KPI hero (navy) ── */
export interface HeroLine { label: string; value: string; valueClass?: string }
export interface HeroBand { text: string; dotClass: string; textClass: string }
export const KpiHero = ({ label, sub, Icon, value, valueClass, lines, band }: {
  label: string; sub: string; Icon: LucideIcon; value: string; valueClass?: string
  lines: HeroLine[]; band?: HeroBand
}) => (
  <section className="flex flex-col rounded-2xl border border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white">{label}</p>
        <p className="text-[11px] uppercase tracking-wide text-white/60">{sub}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"><Icon className="h-4 w-4 text-white/90" /></div>
    </div>
    <p className={cn('mt-3 text-[28px] font-bold leading-tight tabular-nums', valueClass ?? 'text-white')}>{value}</p>
    <div className="mt-3 space-y-1.5 border-t border-white/15 pt-3">
      {lines.map((l) => (
        <div key={l.label} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-white/60">{l.label}</span>
          <span className={cn('font-semibold tabular-nums', l.valueClass ?? 'text-white')}>{l.value}</span>
        </div>
      ))}
    </div>
    {band && (
      <p className="mt-auto flex items-center gap-1.5 pt-3 text-[11px] font-semibold">
        <span className={cn('h-2 w-2 rounded-full', band.dotClass)} /><span className={band.textClass}>{band.text}</span>
      </p>
    )}
  </section>
)

/* ── KPI card (branco) ── */
export const KpiCard = ({ title, sub, Icon, iconClass, value, valueClass, borderClass, hint, footer, children }: {
  title: string; sub: string; Icon: LucideIcon; iconClass: string
  value: string; valueClass?: string; borderClass?: string; hint?: string
  footer?: string; children?: React.ReactNode
}) => (
  <section className={cn('flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900', borderClass ?? 'border-gray-200 dark:border-gray-700')}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[13px] font-semibold text-gray-900 dark:text-gray-100">{title}{hint && <InfoHint text={hint} />}</p>
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{sub}</p>
      </div>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconClass)}><Icon className="h-4 w-4" /></div>
    </div>
    <p className={cn('mt-3 text-[22px] font-bold tabular-nums', valueClass ?? 'text-gray-900 dark:text-gray-100')}>{value}</p>
    {children}
    {footer && <p className="mt-auto pt-3 text-[11px] text-gray-400">{footer}</p>}
  </section>
)

/* ── Card de gráfico (shell) ── */
export const ChartCard = ({ title, Icon, hint, children }: {
  title: string; Icon: LucideIcon; hint?: string; children: React.ReactNode
}) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {hint && <InfoHint text={hint} />}
    </div>
    {children}
  </section>
)

/* ── Gráfico 1: barras horizontais por entidade ── */
export const HBars = ({ data, color }: { data: { nome: string; valor: number }[]; color: string }) => {
  if (data.length === 0) return <Empty />
  const max = Math.max(...data.map((d) => d.valor), 0)
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const w = max > 0 ? (d.valor / max) * 100 : 0
        return (
          <li key={d.nome} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate text-gray-600 dark:text-gray-400" title={d.nome}>{d.nome}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
            </div>
            <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-gray-800 dark:text-gray-200">{formatCurrencyShort(d.valor)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Gráfico 2: mini-barras verticais de 30 dias ── */
export const MiniBars30 = ({ data, color }: { data: { dia: string; valor: number }[]; color: string }) => {
  const max = Math.max(...data.map((d) => d.valor), 0)
  if (max <= 0) return <Empty />
  return (
    <div>
      <div className="flex h-32 items-end gap-px">
        {data.map((d) => {
          const h = max > 0 ? (d.valor / max) * 100 : 0
          return (
            <div
              key={d.dia}
              className="flex-1 rounded-t-sm"
              style={{ height: `${d.valor > 0 ? Math.max(3, h) : 0}%`, backgroundColor: color }}
              title={`${brDateFromIso(d.dia)}: ${formatCurrency(d.valor)}`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400"><span>hoje</span><span>+15d</span><span>+30d</span></div>
    </div>
  )
}

/* ── Gráfico 3: barra empilhada + legenda ── */
export interface StackSegment { label: string; valor: number; color: string }
export const StackedBarLegend = ({ segments, total }: { segments: StackSegment[]; total: number }) => {
  if (total <= 0) return <Empty />
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-md">
        {segments.map((s) => {
          const w = total > 0 ? (s.valor / total) * 100 : 0
          return w > 0 ? <div key={s.label} style={{ width: `${w}%`, backgroundColor: s.color }} /> : null
        })}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate" title={s.label}>{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-gray-800 dark:text-gray-200">
              {formatCurrencyShort(s.valor)} <span className="text-gray-400">{total > 0 ? `${((s.valor / total) * 100).toFixed(0)}%` : ''}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Card A: ranking ── */
export interface RankItem { key: string; nome: string; sub: string; valor: string }
export const RankingCard = ({ title, Icon, hint, items, accentClass }: {
  title: string; Icon: LucideIcon; hint?: string; items: RankItem[]; accentClass: string
}) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {hint && <InfoHint text={hint} />}
    </div>
    {items.length === 0 ? <Empty /> : (
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-center gap-2.5">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', i === 0 ? accentClass : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200" title={it.nome}>{it.nome}</p>
              <p className="text-[11px] text-gray-400">{it.sub}</p>
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">{it.valor}</span>
          </li>
        ))}
      </ol>
    )}
  </section>
)

/* ── Card B: janela / heatmap acumulado ── */
export const JanelaBars = ({ title, Icon, hint, sub, rows, color }: {
  title: string; Icon: LucideIcon; hint?: string; sub?: string
  rows: { faixa: string; valor: number }[]; color: string
}) => {
  const max = Math.max(...rows.map((r) => r.valor), 1)
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {hint && <InfoHint text={hint} />}
      </div>
      {sub && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
      <ul className="space-y-2 py-1">
        {rows.map((r) => (
          <li key={r.faixa}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-gray-600 dark:text-gray-400">{r.faixa}</span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.valor)}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full" style={{ width: `${(r.valor / max) * 100}%`, backgroundColor: color }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ── Abas da tabela (segmented) ── */
export const IntelTabs = <T extends string>({ tabs, active, onChange, right }: {
  tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void; right?: React.ReactNode
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
    <div className="flex items-center gap-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors',
            active === t.id ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}
        >
          {t.label}
        </button>
      ))}
    </div>
    {right}
  </div>
)

export const Badge = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', cls)}>{children}</span>
)

export const Empty = ({ text = 'Sem dados para exibir.' }: { text?: string }) => (
  <p className="py-12 text-center text-sm text-gray-400">{text}</p>
)
