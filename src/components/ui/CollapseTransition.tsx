import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CollapseTransitionProps {
  open: boolean
  children: ReactNode
  className?: string
  /** Duração da transição (ms). Default 250. */
  duration?: number
}

/**
 * Recolhe/expande um bloco com transição suave SEM desmontar o conteúdo.
 *
 * Técnica: grid com `grid-template-rows` 1fr ↔ 0fr (+ opacidade). Só a ALTURA é
 * cortada — a largura fica igual, então gráficos Recharts (ResponsiveContainer)
 * continuam montados com o mesmo tamanho, sem refetch, sem flicker, sem perder
 * tooltip/estado. Enquanto fechado, o conteúdo fica `inert` (fora do tab e de
 * cliques) e `aria-hidden`.
 *
 * `overflow-hidden` só durante a transição e enquanto fechado: aberto e
 * assentado, volta a `visible` pra tooltips/dropdowns que saem da caixa.
 * Respeita prefers-reduced-motion (sem animação).
 */
const CollapseTransition = ({ open, children, className, duration = 250 }: CollapseTransitionProps) => {
  const [settled, setSettled] = useState(open)
  useEffect(() => {
    if (!open) { setSettled(false); return }
    const t = window.setTimeout(() => setSettled(true), duration + 50)
    return () => window.clearTimeout(t)
  }, [open, duration])

  return (
    <div
      aria-hidden={!open}
      inert={!open ? true : undefined}
      className={cn(
        'grid min-w-0 transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {/* `min-w-0`: item de grid tem min-width:auto por padrão e herdaria a largura
          de uma tabela larga, vazando do card e matando o scroll horizontal dela. */}
      <div className={cn('min-h-0 min-w-0', open && settled ? 'overflow-visible' : 'overflow-hidden')}>{children}</div>
    </div>
  )
}

export default CollapseTransition
