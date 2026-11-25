import { cn } from '@/lib/utils'

interface GlobalFilterControlsProps {
  /**
   * Conteúdo do período (normalmente o <DateRangeToolbar />, ou o slot-portal
   * `PAGE_HEADER_ACTIONS_SLOT_ID` no AppLayout). Renderizado antes dos controles
   * de escopo/comparativo. Omitir esconde o trecho.
   */
  dateSlot?: React.ReactNode
  className?: string
}

/**
 * Cluster de filtros globais da TopBar: período → comparativo. O seletor de
 * POSTO não vive mais aqui — foi pro Header (ao lado da rede), em todas as
 * telas. Fonte única usada pelo AppLayout (sub-bar) e pela barra local da
 * Inteligência — mesmo layout/ordem sem duplicar markup.
 */
const GlobalFilterControls = ({ dateSlot, className }: GlobalFilterControlsProps) => {
  // A comparação (vs mês ant. / vs ano ant.) mudou para dentro do menu de
  // período (PeriodPresetSelect). Aqui fica só o período.
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{dateSlot}</div>
}

export default GlobalFilterControls
