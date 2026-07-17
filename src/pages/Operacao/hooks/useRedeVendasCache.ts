import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { fetchVendasCache, fetchVendasSetorDiaria, type ApuracaoVendaRow, type ApuracaoVendaSetorDiariaRow } from '@/api/supabase/apuracao'

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

/**
 * Variante LEVE do read rede-wide: lê a view `apuracao_vendas_setor_diaria`
 * (agregado por posto/dia/setor) em vez do detalhe por produto. Pra consumidores
 * que só precisam da série por setor (ex.: projeção sazonal da Central) — corta
 * de ~675 páginas pra 1–3. Trocar de posto re-agrega no cliente sem refetch
 * (chave rede-wide, sem `empresaCodigos`).
 */
export const useRedeSetorDiaria = (
  dataInicial: string,
  dataFinal: string,
  opts?: { enabled?: boolean; staleTime?: number },
) => {
  const rede = useTenantStore((s) => s.rede)
  return useQuery<ApuracaoVendaSetorDiariaRow[]>({
    queryKey: ['rede-setor-diaria', rede?.id, dataInicial, dataFinal],
    queryFn: () => fetchVendasSetorDiaria({ dataInicial, dataFinal }),
    enabled: (opts?.enabled ?? true) && !!rede && !!dataInicial && !!dataFinal,
    staleTime: opts?.staleTime ?? 5 * 60 * 1000,
  })
}

export default useRedeVendasCache
