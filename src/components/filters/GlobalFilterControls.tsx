import { useLocation } from 'react-router-dom'
import DataFilterModeSelect from '@/components/filters/DataFilterModeSelect'
import ComparisonSelect from '@/components/filters/ComparisonSelect'
import { showsComparison } from '@/lib/globalFilters'
import { useTopbarUi } from '@/store/topbarUi'
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
 * Cluster de filtros globais da TopBar: período → escopo → comparativo. O
 * seletor de POSTO não vive mais aqui — foi pro Header (ao lado da rede), em
 * todas as telas. Fonte única usada pelo AppLayout (sub-bar) e pela barra local
 * da Inteligência — mesmo layout/ordem sem duplicar markup.
 */
const GlobalFilterControls = ({ dateSlot, className }: GlobalFilterControlsProps) => {
  // Comparativo só nas telas que de fato o consomem (senão vira controle morto).
  const { pathname } = useLocation()
  const showComparison = showsComparison(pathname)
  // Modo "ao vivo" desabilita escopo/comparativo. O período (dateSlot) se
  // desabilita sozinho via liveLock.
  const liveLock = useTopbarUi((s) => s.liveLock)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {dateSlot}
      <span className={cn(liveLock && 'pointer-events-none opacity-40')} aria-disabled={liveLock}>
        <DataFilterModeSelect />
      </span>
      {showComparison && (
        <span className={cn(liveLock && 'pointer-events-none opacity-40')} aria-disabled={liveLock}>
          <ComparisonSelect />
        </span>
      )}
    </div>
  )
}

export default GlobalFilterControls
