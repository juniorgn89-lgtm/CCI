import type { ComponentType, ReactNode } from 'react'
import { TrendingUp, TrendingDown, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

type LucideIcon = ComponentType<LucideProps>

/* ── Tons (chip de ícone + tint do card) — rgba funciona em light/dark ── */
export type Tone = 'navy' | 'blue' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'violet' | 'teal'
const TONES: Record<Tone, { icon: string; chip: string; soft: string }> = {
  navy: { icon: '#1e3a5f', chip: 'rgba(30,58,95,0.14)', soft: 'rgba(30,58,95,0.10)' },
  blue: { icon: '#2563eb', chip: 'rgba(37,99,235,0.16)', soft: 'rgba(37,99,235,0.12)' },
  emerald: { icon: '#059669', chip: 'rgba(16,185,129,0.16)', soft: 'rgba(16,185,129,0.12)' },
  rose: { icon: '#e11d48', chip: 'rgba(244,63,94,0.16)', soft: 'rgba(244,63,94,0.12)' },
  amber: { icon: '#d97706', chip: 'rgba(245,158,11,0.18)', soft: 'rgba(245,158,11,0.14)' },
  indigo: { icon: '#4f46e5', chip: 'rgba(99,102,241,0.16)', soft: 'rgba(99,102,241,0.12)' },
  violet: { icon: '#7c3aed', chip: 'rgba(139,92,246,0.16)', soft: 'rgba(139,92,246,0.12)' },
  teal: { icon: '#0d9488', chip: 'rgba(20,184,166,0.16)', soft: 'rgba(20,184,166,0.12)' },
}

const pct1 = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

/* ── DeltaBadge — seta + % vs <ref> ── */
interface DeltaBadgeProps {
  value: number | null | undefined
  label?: string
  /** Quando true, queda é "boa" (verde) — ex.: tempo médio. */
  invert?: boolean
  small?: boolean
}
export const DeltaBadge = ({ value, label = 'mês ant.', invert = false, small = false }: DeltaBadgeProps) => {
  if (value === null || value === undefined) return null
  const positive = value >= 0
  const good = invert ? !positive : positive
  const Arrow = positive ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold tabular-nums',
        small ? 'text-[10px]' : 'text-[11px]',
        good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}
    >
      <Arrow className={small ? 'h-3 w-3' : 'h-[13px] w-[13px]'} />
      {positive ? '+' : ''}{value.toFixed(2).replace('.', ',')}%
      <span className="font-medium text-gray-400 dark:text-gray-500">vs {label}</span>
    </span>
  )
}

/* ── KpiCard ── */
interface KpiCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  Icon?: LucideIcon
  delta?: number | null
  deltaLabel?: string
  /** Ocupa 2 colunas no grid. */
  span2?: boolean
  /** Valor maior (card de destaque). */
  big?: boolean
}
export const KpiCard = ({ label, value, sub, tone = 'navy', Icon, delta, deltaLabel, span2, big }: KpiCardProps) => {
  const t = TONES[tone]
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#3a3a3a] dark:bg-[#242424]',
        big ? 'p-3.5' : 'px-3 py-2.5',
        span2 && 'col-span-2',
      )}
      style={{ backgroundImage: `linear-gradient(150deg, ${t.soft}, transparent 70%)` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
        {Icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px]" style={{ background: t.chip }}>
            <Icon className="h-3.5 w-3.5" style={{ color: t.icon }} />
          </span>
        )}
      </div>
      <div
        className={cn('mt-1.5 font-bold tabular-nums leading-[1.05] tracking-[-0.01em] text-gray-900 dark:text-gray-100', big ? 'text-[26px]' : 'text-[19px]')}
      >
        {value}
      </div>
      {delta !== undefined && delta !== null && <div className="mt-1"><DeltaBadge value={delta} label={deltaLabel} /></div>}
      {sub && <div className="mt-0.5 text-[10.5px] text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  )
}

/* ── Section (card com header de chip) ── */
interface SectionProps {
  Icon?: LucideIcon
  title: string
  right?: ReactNode
  accent?: Tone
  children: ReactNode
  /** Sem padding interno (listas/tabelas coladas nas bordas). */
  flush?: boolean
}
export const Section = ({ Icon, title, right, accent = 'navy', children, flush }: SectionProps) => {
  const t = TONES[accent]
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#3a3a3a] dark:bg-[#242424]">
      <div className="flex items-center justify-between gap-2.5 border-b border-gray-100 px-3.5 py-2.5 dark:border-[#303030]">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg" style={{ background: t.chip }}>
              <Icon className="h-[15px] w-[15px]" style={{ color: t.icon }} />
            </span>
          )}
          <span className="truncate text-[13.5px] font-semibold text-gray-900 dark:text-gray-100">{title}</span>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className={flush ? '' : 'p-3'}>{children}</div>
    </div>
  )
}

/* ── ProgressBar ── */
interface ProgressBarProps {
  pct: number
  /** cor da barra (hex/var). Default = navy. */
  color?: string
  height?: number
}
export const ProgressBar = ({ pct, color = '#3b82f6', height = 4 }: ProgressBarProps) => (
  <div className="w-full overflow-hidden rounded-full bg-gray-100 dark:bg-[#303030]" style={{ height }}>
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
  </div>
)

/* ── Badge / MarginPill ── */
interface BadgeProps { children: ReactNode; tone?: Tone; soft?: boolean }
export const Badge = ({ children, tone = 'navy', soft = true }: BadgeProps) => {
  const t = TONES[tone]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
      style={{ background: soft ? t.chip : t.icon, color: soft ? t.icon : '#fff' }}
    >
      {children}
    </span>
  )
}

export const marginTone = (v: number, threshold = 11): Tone =>
  v >= threshold ? 'emerald' : v >= threshold * 0.7 ? 'amber' : 'rose'

export const MarginPill = ({ value, threshold = 11 }: { value: number; threshold?: number }) => (
  <Badge tone={marginTone(value, threshold)}>{pct1(value)}</Badge>
)

/* ── Segmented ── */
interface SegmentedOption { value: string; label: string }
interface SegmentedProps {
  options: (string | SegmentedOption)[]
  value: string
  onChange: (v: string) => void
  scroll?: boolean
}
export const Segmented = ({ options, value, onChange, scroll }: SegmentedProps) => (
  <div className={cn('flex gap-1 rounded-[10px] bg-gray-100 p-[3px] dark:bg-[#303030]', scroll && 'overflow-x-auto [scrollbar-width:none]')}>
    {options.map((o) => {
      const v = typeof o === 'string' ? o : o.value
      const lbl = typeof o === 'string' ? o : o.label
      const active = v === value
      return (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
            scroll ? 'shrink-0' : 'flex-1',
            active ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-[#2563eb]' : 'text-gray-400 dark:text-gray-500',
          )}
        >
          {lbl}
        </button>
      )
    })}
  </div>
)

/* ── ScrollTabs (abas de tela com sublinhado) ── */
interface ScrollTab { id: string; label: string }
interface ScrollTabsProps { tabs: ScrollTab[]; value: string; onChange: (id: string) => void }
export const ScrollTabs = ({ tabs, value, onChange }: ScrollTabsProps) => (
  <div className="-mx-3.5 flex gap-1 overflow-x-auto border-b border-gray-200 px-3.5 [scrollbar-width:none] dark:border-[#3a3a3a]">
    {tabs.map((tb) => {
      const active = tb.id === value
      return (
        <button
          key={tb.id}
          type="button"
          onClick={() => onChange(tb.id)}
          className={cn(
            '-mb-px shrink-0 whitespace-nowrap border-b-2 px-1.5 pb-2.5 pt-3 text-[13px]',
            active
              ? 'border-[#2563eb] font-semibold text-[#2563eb] dark:border-[#60a5fa] dark:text-[#60a5fa]'
              : 'border-transparent font-medium text-gray-400 dark:text-gray-500',
          )}
        >
          {tb.label}
        </button>
      )
    })}
  </div>
)
