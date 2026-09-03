import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import type { Empresa } from '@/api/types/empresa'

/** Um posto da rede (dados empresariais + endereço da Quality). */
export type RedePosto = Empresa

/**
 * Todos os postos da rede (Quality). Rede-wide: ignora o filtro de empresa
 * (sempre toda a rede permitida). É um diretório do cliente — sem nada de
 * prospecção (isso é interno da CCI, vive no Prospecção360).
 */
export const useRedePostos = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 500 }),
    staleTime: 10 * 60 * 1000,
  })
  const permitidas = useEmpresasPermitidas(data?.resultados ?? [])
  const postos = useMemo<RedePosto[]>(() => permitidas, [permitidas])
  return { postos, isLoading, error }
}
