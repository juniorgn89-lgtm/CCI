import { cn } from '@/lib/utils'
import type { ReposicaoHero } from '@/pages/Dashboard/components/reabastecimento/types'

/** KPI hero (navy) da aba Reabastecimento — "total a comprar / compra sugerida".
 *  Componente burro: tudo vem do modelo. */
const KpiHero = ({ hero }: { hero: ReposicaoHero }) => {
  const { label, hint, value, unit, Icon, footer, footerBadge } = hero
  return (
    <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 text-left shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          {hint && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">{hint}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-white">
        {value}{unit && <span className="ml-1 text-xl">{unit}</span>}
      </p>
      {(footer || footerBadge) && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/15 pt-3">
          {footer && <span className="text-[11px] text-white/60">{footer}</span>}
          {footerBadge && <span className={cn('text-xs font-semibold tabular-nums text-amber-300', !footer && 'ml-auto')}>{footerBadge}</span>}
        </div>
      )}
    </div>
  )
}

export default KpiHero
