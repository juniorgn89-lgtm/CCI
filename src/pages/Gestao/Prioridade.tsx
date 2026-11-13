import { Flag } from 'lucide-react'
import { PRIORIDADE_LABEL, type Prioridade } from '@/api/supabase/gestaoTarefas'
import { cn } from '@/lib/utils'

const COR: Record<Prioridade, string> = {
  urgente: 'bg-red-600 text-white dark:bg-red-600',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  media: '',
  baixa: '',
}

/**
 * Selo de prioridade. Só Alta e Urgente aparecem: Média é o normal e Baixa
 * não pede atenção, então não poluem a lista.
 */
export const SeloPrioridade = ({ p, className }: { p: Prioridade | null | undefined; className?: string }) => {
  if (p !== 'alta' && p !== 'urgente') return null
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', COR[p], className)} title={`Prioridade ${PRIORIDADE_LABEL[p].toLowerCase()}`}>
      <Flag className="h-2.5 w-2.5" />{PRIORIDADE_LABEL[p]}
    </span>
  )
}
