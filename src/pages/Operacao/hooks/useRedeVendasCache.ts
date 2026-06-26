import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { fetchVendasCache, type ApuracaoVendaRow } from '@/api/supabase/apuracao'

/**
 * Fetch CANÔNICO (compartilhado) das vendas rede-wide do cache `apuracao_vendas`
 * para um range. Chave única `['rede-vendas-cache', rede, ini, end]`.
 *
 * Antes, Combustível (`fuel-cache-vendas`), Conveniência (`conv-cache-vendas`) e
 * Automotivo (`pista-cache-vendas`) baixavam a MESMA leitura rede-wide para o
 * mesmo range sob 3 chaves privadas → 3 fetches idênticos. Usando esta chave
 * comum, o React Query deduplica e a 2ª/3ª aba reaproveitam o cache (24h gcTime).
 *
 * É rede-wide (sem `empresaCodigos`) de propósito: trocar de posto re-agrega no
 * cliente sem refetch. Cada tela continua filtrando por setor/posto como já fazia
 * — os dados que chegam são IDÊNTICOS aos de antes (mudança transparente).
 */
export const useRedeVendasCache = (
  dataInicial: string,
  dataFinal: string,
  opts?: { enabled?: boolean; staleTime?: number },
) => {
  const rede = useTenantStore((s) => s.rede)
  return useQuery<ApuracaoVendaRow[]>({
    queryKey: ['rede-vendas-cache', rede?.id, dataInicial, dataFinal],
    queryFn: () => fetchVendasCache({ dataInicial, dataFinal }),
    enabled: (opts?.enabled ?? true) && !!rede && !!dataInicial && !!dataFinal,
    staleTime: opts?.staleTime ?? 5 * 60 * 1000,
  })
}

export default useRedeVendasCache
