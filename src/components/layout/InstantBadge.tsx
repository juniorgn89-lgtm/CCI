import { Zap } from 'lucide-react'

/**
 * Badge "INSTANTÂNEO" — sinaliza que os números vieram do snapshot mensal no
 * Supabase (cache), com carregamento imediato em vez de bater na API ao vivo.
 */
const InstantBadge = ({
  title = 'Dados do snapshot mensal — carregamento instantâneo',
}: {
  title?: string
}) => (
  <span
    title={title}
    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400"
  >
    <Zap className="h-2.5 w-2.5" />
    instantâneo
  </span>
)

export default InstantBadge
