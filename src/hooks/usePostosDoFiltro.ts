import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useFilterStore } from '@/store/filters'

/** Postos do filtro do topo (ou todos os permitidos, sem filtro), com nome — para seletores de posto dentro de janelas. */
const usePostosDoFiltro = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresas = useMemo(
    () => (data?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })),
    [data],
  )
  const permitidas = useEmpresasPermitidas(empresas)
  return useMemo(
    () => (empresaCodigos.length > 0 ? permitidas.filter((e) => empresaCodigos.includes(e.codigo)) : permitidas),
    [permitidas, empresaCodigos],
  )
}

export default usePostosDoFiltro
