import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useFilterStore } from '@/store/filters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'

export interface EmpresaInfo {
  codigo: number
  nome: string
  cnpj: string
}

/**
 * Empresa em foco — nome (fantasia ou razão) + CNPJ. Pra usar em headers de
 * relatório/cards que mostram dados de UM posto.
 *
 * Retorna `null` quando há mais de 1 posto selecionado (ou nenhum permitido).
 */
export const useEmpresaAtual = (): EmpresaInfo | null => {
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

  if (codigo == null) return null
  const emp = empresas.find((e) => e.empresaCodigo === codigo)
  if (!emp) return null
  return {
    codigo,
    nome: emp.fantasia || emp.razao || `Posto ${codigo}`,
    cnpj: emp.cnpj,
  }
}

export default useEmpresaAtual
