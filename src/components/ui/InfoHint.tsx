import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

interface InfoHintProps {
  /** Texto de ajuda exibido no tooltip. */
  text: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Classe extra pro ícone "?" (cor/tamanho). */
  className?: string
}

/**
 * Ícone de ajuda "?" + tooltip PADRÃO do sistema (fundo escuro, portal,
 * largura confortável). Único componente de ajuda — substitui os `title=`
 * nativos e os tooltips CSS ad-hoc.
 *
 * Abre no hover/focus (desktop) E no toque (mobile): o clique alterna o estado
 * controlado. `stopPropagation` evita disparar onClick de cards/linhas que
 * envolvem o "?".
 */
const InfoHint = ({ text, side = 'top', align = 'center', className }: InfoHintProps) => {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Ajuda"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            className={cn(
              'inline-flex shrink-0 cursor-help text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300',
              className,
            )}
          >
            <HelpCircle className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} align={align}>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default InfoHint
