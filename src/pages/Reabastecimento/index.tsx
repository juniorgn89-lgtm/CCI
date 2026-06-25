import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import NivelTanquesCard from '@/pages/Dashboard/components/NivelTanquesCard'
import useIsMobile from '@/hooks/useIsMobile'
import ReabastecimentoMobile from '@/pages/Reabastecimento/ReabastecimentoMobile'

/**
 * Módulo Reabastecimento (grupo Posto) — nível dos tanques, última compra e
 * projeção até o fim do mês. Nível de tanque é FÍSICO por-posto (não soma na
 * rede), então a consolidação aqui = um card por posto do filtro: Todos = todos
 * os postos empilhados; subconjunto = esses; 1 posto = um.
 */
const Reabastecimento = () => {
  const { empresaCodigos } = useFilterStore()
  const isMobile = useIsMobile()

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  // `[]` = Todos os postos permitidos; subconjunto = os selecionados.
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))

  if (isMobile) return <ReabastecimentoMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <FocusModeToggle />
        </div>
      </PageHeaderTitle>

      {postos.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          Nenhum posto disponível.
        </p>
      ) : (
        postos.map((e) => (
          <div key={e.codigo} className="space-y-2">
            {postos.length > 1 && (
              <h2 className="px-0.5 text-sm font-semibold text-gray-700 dark:text-gray-300">{e.fantasia}</h2>
            )}
            <NivelTanquesCard empresaCodigo={e.codigo} />
          </div>
        ))
      )}
    </div>
  )
}

export default Reabastecimento
