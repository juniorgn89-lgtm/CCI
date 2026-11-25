import type { ReactNode } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

/**
 * Balão explicativo de BOTÃO (não é o "?" de ajuda — esse é o InfoHint).
 * Só aparece com o mouse PARADO em cima por um tempo (1,2 s), para não
 * atrapalhar quem só passa o mouse ou clica direto. Fecha ao clicar.
 * O `span` em volta faz o balão funcionar até com botão desabilitado.
 */
const BalaoAcao = ({ texto, children, lado = 'top', atraso = 1200 }: {
  texto: ReactNode
  children: ReactNode
  lado?: 'top' | 'bottom' | 'left' | 'right'
  /** ms com o mouse parado até abrir (ícones do topo usam menos). */
  atraso?: number
}) => (
  <TooltipProvider delayDuration={atraso} skipDelayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={lado}>{texto}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

export default BalaoAcao
