import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'

/**
 * Códigos de empresa EM ESCOPO — o mesmo critério do useFinanceData: o filtro global
 * (`empresaCodigos`) quando há seleção, senão TODAS as permitidas do usuário. Usado pra
 * filtrar no cliente dados buscados rede-wide (ex.: duplicatas) e casar com os títulos,
 * respeitando permissão. Lista vazia = carregando / sem restrição → o chamador trata
 * como "tudo" (não filtra).
 */
export const useScopedEmpresaCodes = (): number[] => {
  const { empresaCodigos } = useFilterStore()
  const { data } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(data?.resultados ?? [])
  return useMemo(
    () => (empresaCodigos.length > 0 ? empresaCodigos : permitidas.map((e) => e.codigo)),
    [empresaCodigos, permitidas],
  )
}

export default useScopedEmpresaCodes
