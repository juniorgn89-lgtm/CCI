import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useFilterStore } from '@/store/filters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'

/**
 * Nome de exibição do posto atualmente em foco, pra usar nos headers das telas
 * por-posto (ex.: "Conveniência · POSTO ITAPOA").
 *
 * Retorna o nome quando há exatamente UM posto em foco: o selecionado no filtro
 * global, ou — pra usuário de posto único — o único permitido (auto-select).
 * Em qualquer outro caso (nenhum ou vários) retorna string vazia, e o caller
 * mostra só o título base.
 */
export const useEmpresaNome = (): string => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresas = data?.resultados ?? []
  const permitidas = useEmpresasPermitidas(empresas)

  let codigo: number | null = null
  if (empresaCodigos.length === 1) codigo = empresaCodigos[0]
  else if (empresaCodigos.length === 0 && permitidas.length === 1) codigo = permitidas[0].codigo

  if (codigo == null) return ''
  const emp = empresas.find((e) => e.empresaCodigo === codigo)
  return emp?.fantasia || emp?.razao || `Posto ${codigo}`
}

export default useEmpresaNome
