import { CalendarRange } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Intervalo de datas coberto pela janela móvel (hoje − (N−1) dias … hoje). */
const periodo = (janelaDias: number): string => {
  const fim = new Date()
  const ini = new Date()
  ini.setDate(ini.getDate() - (janelaDias - 1))
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return `${fmt(ini)} a ${fmt(fim)}`
}

/**
 * "Janela de cálculo" 30/60/90 dias + o período coberto. Usada no Estoques
 * (Visão Geral, Produtos) e em Compras › Análise de estoque para comprar.
 */
export const JanelaCalculoBar = ({ value, onChange }: { value: 30 | 60 | 90; onChange: (v: 30 | 60 | 90) => void }) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
      <CalendarRange className="h-3.5 w-3.5" />
      Janela de cálculo
    </span>
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
      {([30, 60, 90] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            'h-7 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-all',
            value === opt
              ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
          )}
        >
          {opt} dias
        </button>
      ))}
    </div>
    <span className="text-[11px] tabular-nums text-gray-400/80 dark:text-gray-500/80">{periodo(value)}</span>
  </div>
)

export const EstoqueTableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)
