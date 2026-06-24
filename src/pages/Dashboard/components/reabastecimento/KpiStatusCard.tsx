import { cn } from '@/lib/utils'
import type { ReposicaoKpi } from '@/pages/Dashboard/components/reabastecimento/types'
import { toneClasses } from '@/pages/Dashboard/components/reabastecimento/tones'

/** Card de status ao lado do hero (Críticos / Em alerta / Negativo / …). Burro. */
const KpiStatusCard = ({ kpi }: { kpi: ReposicaoKpi }) => {
  const t = toneClasses(kpi.tone)
  const { label, hint, value, Icon, footer } = kpi
  return (
    <div className={cn('flex flex-col rounded-2xl border bg-white p-5 text-left shadow-sm dark:bg-gray-900', t.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
          {hint && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{hint}</p>}
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.bg)}>
          <Icon className={cn('h-5 w-5', t.text)} />
        </div>
      </div>
      <p className={cn('mt-3 text-3xl font-bold tabular-nums', t.text)}>{value}</p>
      {footer && (
        <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
          <span className="text-[11px] text-gray-400">{footer}</span>
        </div>
      )}
    </div>
  )
}

export default KpiStatusCard
