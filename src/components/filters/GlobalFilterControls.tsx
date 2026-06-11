import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import CompanySelect from '@/components/filters/CompanySelect'
import DataFilterModeSelect from '@/components/filters/DataFilterModeSelect'
import ComparisonSelect from '@/components/filters/ComparisonSelect'
import { showsComparison } from '@/lib/globalFilters'
import { useTopbarUi } from '@/store/topbarUi'
import { cn } from '@/lib/utils'

interface GlobalFilterControlsProps {
  /**
   * Conteúdo do período (normalmente o <DateRangeToolbar />, ou o slot-portal
   * `PAGE_HEADER_ACTIONS_SLOT_ID` no AppLayout). Renderizado entre o seletor de
   * posto e os controles de escopo/comparativo. Omitir esconde o trecho.
   */
  dateSlot?: React.ReactNode
  className?: string
  /** Esconde o seletor de posto (ex.: na Central da Rede, que é sempre rede-wide). */
  hideCompanySelect?: boolean
}

/**
 * Cluster ÚNICO de filtros globais da TopBar: posto → período → escopo →
 * comparativo. Fonte única usada tanto pelo AppLayout (sub-bar consolidada de
 * todas as telas) quanto pela barra local da Inteligência — garante o mesmo
 * layout/ordem/larguras sem duplicar markup nem a lógica de visibilidade.
 *
 * O seletor de posto some quando o usuário só tem UMA empresa permitida (não há
 * o que escolher). A query de empresas é cacheada (queryKey ['empresas']), então
 * múltiplas instâncias deduplicam.
 */
const GlobalFilterControls = ({ dateSlot, className, hideCompanySelect }: GlobalFilterControlsProps) => {
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const showCompanySelect = !hideCompanySelect && empresasPermitidas.length !== 1
  // Comparativo só nas telas que de fato o consomem (senão vira controle morto).
  const { pathname } = useLocation()
  const showComparison = showsComparison(pathname)
  // Modo "ao vivo" desabilita escopo/comparativo/posto (não fazem sentido lá).
  // O período (dateSlot/DateRangeToolbar) se desabilita sozinho via liveLock.
  const liveLock = useTopbarUi((s) => s.liveLock)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {showCompanySelect && (
        <span className={cn(liveLock && 'pointer-events-none opacity-40')} aria-disabled={liveLock}>
          <CompanySelect />
        </span>
      )}
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
