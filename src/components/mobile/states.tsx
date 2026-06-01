import { Inbox, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Card vazio (âmbar) ── */
export const EmptyCard = ({
  title = 'Sem dados',
  desc = 'Não há dados para o período e posto selecionados.',
}: { title?: string; desc?: string }) => (
  <div className="flex flex-col items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
    <Inbox className="h-7 w-7 text-amber-600 dark:text-amber-400" />
    <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{title}</span>
    <span className="max-w-[220px] text-[11.5px] text-gray-500 dark:text-gray-400">{desc}</span>
  </div>
)

/* ── Nota "sem custo apurado" ── */
export const NoCostNote = ({ text = 'margem estimada.' }: { text?: string }) => (
  <div className="flex items-center gap-1.5 rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-gray-600 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-gray-300">
    <AlertTriangle className="h-[13px] w-[13px] shrink-0 text-amber-600 dark:text-amber-400" />
    <span><strong className="font-semibold text-gray-900 dark:text-gray-100">Sem custo apurado</strong> — {text}</span>
  </div>
)

/* ── Skeleton (shimmer) ── */
export const Skel = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-[#303030]', className)} />
)

/* ── Tela de carregamento ── */
export const LoadingScreen = ({ message = 'Carregando dados…' }: { message?: string }) => (
  <div className="flex flex-col items-center gap-4 py-16">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f]">
      <Loader2 className="h-6 w-6 animate-spin text-white" />
    </div>
    <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{message}</p>
    <div className="w-full max-w-[280px] space-y-2.5">
      {[0, 1, 2].map((i) => (
        <Skel key={i} className="h-16 w-full" />
      ))}
    </div>
  </div>
)
