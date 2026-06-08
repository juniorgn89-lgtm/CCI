import { Flame, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Section, ProgressBar, Badge } from '@/components/mobile/primitives'

export interface ProjMetric {
  label: string
  /** Valor já realizado (número cru). */
  realizado: number
  /** Valor projetado pro fim do período (calculado pelo chamador, método do app). */
  proj: number
  /** Formatador número → string (BRL, litros, %…). */
  fmt: (n: number) => string
  /** Razão/tendência (margem, ticket, L.B./litro): projeção por tendência, SEM barra cumulativa. */
  ratio?: boolean
}

interface ProjecaoSectionProps {
  title?: string
  metrics: ProjMetric[]
  /** Dia atual / dias do mês / fração decorrida (0–1). */
  periodo: { dia: number; dias: number; frac: number }
  subtitle?: string
}

const AMBER = '#d97706'

/**
 * Bloco "Projeção do mês" reutilizável. Cards **total** (barra cumulativa
 * realizado/proj) e cards **razão/tendência** (margem etc., sem barra — mostram
 * a variação realizado→proj). O `proj` vem pronto do chamador (método do app).
 */
const ProjecaoSection = ({ title = 'Projeção do mês', metrics, periodo, subtitle = 'Período decorrido' }: ProjecaoSectionProps) => {
  const pct = Math.round(periodo.frac * 100)
  const odd = metrics.length % 2 === 1

  return (
    <Section
      Icon={Flame}
      title={title}
      accent="amber"
      right={<Badge tone="amber">Dia {periodo.dia}/{periodo.dias}</Badge>}
    >
      <div className="mb-3">
        <div className="mb-1.5 flex justify-between text-[10.5px] text-gray-400 dark:text-gray-500">
          <span>{subtitle}</span>
          <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{pct}%</span>
        </div>
        <ProgressBar pct={pct} color={AMBER} height={5} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => {
          const span2 = odd && i === metrics.length - 1
          const cardCls = cn(
            'rounded-[11px] border border-gray-200 bg-white px-3 py-2.5 dark:border-[#3a3a3a] dark:bg-[#242424]',
            span2 && 'col-span-2',
          )
          if (m.ratio) {
            const tr = ((m.proj - m.realizado) / (m.realizado || 1)) * 100
            const up = tr >= 0
            const TrendArrow = up ? TrendingUp : TrendingDown
            return (
              <div key={m.label} className={cardCls}>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">{m.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[18px] font-bold tabular-nums tracking-[-0.01em] text-gray-900 dark:text-gray-100">{m.fmt(m.proj)}</span>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">proj.</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">realizado {m.fmt(m.realizado)}</span>
                  <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    <TrendArrow className="h-2.5 w-2.5" />{up ? '+' : ''}{tr.toFixed(0).replace('.', ',')}%
                  </span>
                  <span className="text-[9.5px] text-gray-400 dark:text-gray-500">tendência</span>
                </div>
              </div>
            )
          }
          const rpct = Math.min(100, Math.round((m.realizado / (m.proj || 1)) * 100))
          return (
            <div key={m.label} className={cardCls}>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">{m.label}</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[18px] font-bold tabular-nums tracking-[-0.01em] text-gray-900 dark:text-gray-100">{m.fmt(m.proj)}</span>
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">proj.</span>
              </div>
              <div className="mt-0.5 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">realizado {m.fmt(m.realizado)} · {rpct}%</div>
              <div className="mt-1.5"><ProgressBar pct={rpct} color={AMBER} height={3} /></div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

export default ProjecaoSection
