import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchBombas, fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

/**
 * Prefetches reference data (produtos, empresas, grupos, etc.) on app mount.
 * These are slow-changing catalogs that every module needs.
 * By prefetching them early, page navigations are much faster.
 */
const usePrefetch = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const opts = { staleTime: 30 * 60 * 1000 }

    queryClient.prefetchQuery({
      queryKey: ['produtos'],
      queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
      ...opts,
    })

    queryClient.prefetchQuery({
      queryKey: ['grupos'],
      queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
      ...opts,
    })

    queryClient.prefetchQuery({
      queryKey: ['empresas'],
      queryFn: () => fetchEmpresas(),
      staleTime: 10 * 60 * 1000,
    })

    queryClient.prefetchQuery({
      queryKey: ['funcionarios'],
      queryFn: () => fetchAllPages((p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
      ...opts,
    })

    queryClient.prefetchQuery({
      queryKey: ['bombas'],
      queryFn: () => fetchBombas(),
      ...opts,
    })

    queryClient.prefetchQuery({
      queryKey: ['bicos'],
      queryFn: () => fetchAllPages((p) => fetchBicos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
      ...opts,
    })
  }, [queryClient])
}

export default usePrefetch
