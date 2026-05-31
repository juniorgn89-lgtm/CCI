import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import CompanySelect from '@/components/filters/CompanySelect'
import DataFilterModeSelect from '@/components/filters/DataFilterModeSelect'
import ComparisonSelect from '@/components/filters/ComparisonSelect'
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

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {showCompanySelect && <CompanySelect />}
      {dateSlot}
      <DataFilterModeSelect />
      <ComparisonSelect />
    </div>
  )
}

export default GlobalFilterControls
