import { cn } from '@/lib/utils'
import type { ReposicaoItem } from '@/pages/Dashboard/components/reabastecimento/types'
import { toneClasses } from '@/pages/Dashboard/components/reabastecimento/tones'

/** Card de item que precisa de atenção (tanque/produto). Burro: cor/unidade
 *  vêm do modelo (badge.tone, bar.tone, bar.kind). */
const ReposicaoItemCard = ({ item }: { item: ReposicaoItem }) => {
  const badge = toneClasses(item.badge.tone)
  const barTone = toneClasses(item.bar.tone)
  const pct = item.bar.kind === 'pct'
    ? Math.max(0, Math.min(100, item.bar.value))
    : item.bar.max > 0 ? Math.max(0, Math.min(100, (item.bar.value / item.bar.max) * 100)) : 0
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-gray-900 dark:text-gray-100">{item.nome}</p>
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{item.sub}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', badge.bg, badge.text)}>
          {item.badge.label}
        </span>
      </div>

      <p className={cn('mt-3 text-xl font-bold tabular-nums', barTone.text)}>{item.big}</p>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={cn('h-full rounded-full transition-all', barTone.bar)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">{item.ref}</p>
      {item.extraLine && (
        <p className={cn('mt-1 text-[11px] font-medium', toneClasses(item.extraLine.tone).text)}>{item.extraLine.text}</p>
      )}

      <div className="mt-3 space-y-1 border-t border-gray-100 pt-2.5 dark:border-gray-800">
        {item.ultimaCompra && (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-gray-400">Última compra</span>
            <span className="tabular-nums text-gray-600 dark:text-gray-300">{item.ultimaCompra}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-gray-400">Sugestão</span>
          <span className="text-right">
            <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">{item.sugestao}</span>
            {item.sugestaoSub && <span className="ml-1 text-gray-400">{item.sugestaoSub}</span>}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ReposicaoItemCard
