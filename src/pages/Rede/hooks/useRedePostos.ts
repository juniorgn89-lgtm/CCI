import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import type { Empresa } from '@/api/types/empresa'
import { useRedeProspeccao, type ProspeccaoInfo } from './useRedeProspeccao'

/** Um posto da rede + (se houver) quem o trouxe pela prospecção. */
export interface RedePosto extends Empresa {
  prospeccao?: ProspeccaoInfo
}

const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

/**
 * Todos os postos da rede (Quality) casados com a ponte de prospecção por CNPJ.
 * Rede-wide: ignora o filtro de empresa (sempre toda a rede permitida).
 */
export const useRedePostos = () => {
  const { data: empresasData, isLoading: loadingEmpresas, error } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 500 }),
    staleTime: 10 * 60 * 1000,
  })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const { data: prosMap, isLoading: loadingPros } = useRedeProspeccao()

  const postos = useMemo<RedePosto[]>(
    () =>
      permitidas.map((e) => ({
        ...e,
        prospeccao: prosMap?.get(onlyDigits(e.cnpj)),
      })),
    [permitidas, prosMap]
  )

  return { postos, isLoading: loadingEmpresas, loadingProspeccao: loadingPros, error }
}
