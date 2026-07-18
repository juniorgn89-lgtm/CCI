import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'

/**
 * Mapa código → nome (fantasia) do posto. Compartilhado pelas tabelas "por
 * posto" do módulo Comercial. Reusa a query ['empresas'] (mesma chave dos
 * outros consumidores → sem fetch extra).
 */
const usePostoNomes = (): Map<number, string> => {
  const { data } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  return useMemo(() => {
    const m = new Map<number, string>()
    for (const e of data?.resultados ?? []) m.set(e.codigo, e.fantasia || e.razao || `Posto ${e.codigo}`)
    return m
  }, [data])
}

export default usePostoNomes
