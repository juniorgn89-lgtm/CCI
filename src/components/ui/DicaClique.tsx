import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MousePointerClick, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Balão "o que este cartão abre": aparece quando o mouse PARA em cima de um
 * cartão clicável por um instante (não pisca ao só passar) e some ao sair ou
 * clicar. Só com mouse: no toque o cartão já abre direto.
 *
 * Envolve o cartão (a div ocupa a mesma altura do grid). Substitui o `title=`
 * nativo nesses cartões.
 */
interface DicaCliqueProps {
  titulo: string
  texto: string
  Icon?: LucideIcon
  /** Espera antes de mostrar (ms). */
  atraso?: number
  /** false = só repassa o cartão (ex.: cartão sem clique). */
  ativo?: boolean
  className?: string
  children: ReactNode
}

const DicaClique = ({ titulo, texto, Icon = MousePointerClick, atraso = 1400, ativo = true, className, children }: DicaCliqueProps) => {
  const [aberto, setAberto] = useState(false)
  const timer = useRef<number | null>(null)
  const limpar = () => { if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null } }
  useEffect(() => limpar, [])
  if (!ativo) return <>{children}</>

  return (
    <div
      className={cn('relative h-full', className)}
      onPointerEnter={(e) => { if (e.pointerType !== 'mouse') return; limpar(); timer.current = window.setTimeout(() => setAberto(true), atraso) }}
      onPointerLeave={() => { limpar(); setAberto(false) }}
      onPointerDown={() => { limpar(); setAberto(false) }}
    >
      {children}
      {aberto && (
        <div role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-40 mt-2.5 w-[272px] -translate-x-1/2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* setinha apontando para o cartão */}
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-teal-500/40 bg-[#0f1b2b]" />
          <div className="relative overflow-hidden rounded-xl border border-teal-500/40 bg-[#0f1b2b] p-3 text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-tight">{titulo}</p>
                <p className="mt-1 text-[12px] leading-snug text-white/70">{texto}</p>
              </div>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[11.5px] font-semibold text-teal-300">
              <MousePointerClick className="h-3.5 w-3.5" /> Clique no cartão para abrir
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default DicaClique
