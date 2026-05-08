import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

/**
 * Prefetch enxuto: carrega APENAS dados de referência pequenos e compartilhados
 * (empresas, grupos, produtos) que praticamente todos os módulos usam.
 *
 * Os dados pesados de cada módulo (abastecimentos, caixas, vendas, estoques,
 * financeiro) NÃO são prefetched — são carregados sob demanda quando o
 * usuário entra no módulo. Isso evita disparar 20+ queries por mudança de
 * empresa/período. TanStack Query continua deduplicando no momento da
 * navegação, então não há requests duplicados.
 *
 * Resultado: load inicial muito mais rápido. Trade-off: primeira visita a
 * cada módulo tem ~1-2s de loading (aceitável; a maioria dos usuários
 * visita 2-3 módulos por sessão, não todos).
 */
// Dados de referência (empresas, grupos, produtos) raramente mudam dentro de uma
// sessão. `staleTime: Infinity` impede refetch automático mesmo após muito tempo;
// usuário ainda pode forçar refresh pelo botão do header se cadastrou algo novo.
const REFERENCE_STALE_TIME = Infinity

const useModulePrefetch = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['empresas'],
      queryFn: () => fetchEmpresas({ limite: 200 }),
      staleTime: REFERENCE_STALE_TIME,
    })

    queryClient.prefetchQuery({
      queryKey: ['grupos'],
      queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
      staleTime: REFERENCE_STALE_TIME,
    })

    queryClient.prefetchQuery({
      queryKey: ['produtos'],
      queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
      staleTime: REFERENCE_STALE_TIME,
    })
  }, [queryClient])
}

export default useModulePrefetch
