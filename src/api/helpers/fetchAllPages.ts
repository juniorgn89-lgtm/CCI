import type { PaginatedResponse } from '@/api/types/common'

interface PaginatedFetchFn<T> {
  (params: { ultimoCodigo?: number; limite: number }): Promise<PaginatedResponse<T>>
}

export const fetchAllPages = async <T>(
  fetchFn: PaginatedFetchFn<T>,
  limite = 1000,
  maxPages = 10
): Promise<T[]> => {
  const allResults: T[] = []
  let ultimoCodigo: number | undefined
  let page = 0

  while (page < maxPages) {
    const response = await fetchFn({ ultimoCodigo, limite })
    allResults.push(...response.resultados)

    if (response.resultados.length < limite) break

    ultimoCodigo = response.ultimoCodigo
    page++
  }

  return allResults
}
