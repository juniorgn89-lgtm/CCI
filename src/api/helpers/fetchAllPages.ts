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

    // Última página — retornou menos que o limite.
    if (response.resultados.length < limite) break

    // Endpoint que IGNORA o `limite` e devolve tudo numa página só (ex.:
    // /PRODUTO_ESTOQUE retorna ~9.5k linhas mesmo pedindo 1.000). Repaginar só
    // traria as MESMAS linhas (duplicação Nx) — para aqui.
    if (response.resultados.length > limite) break

    // Cursor não avançou (mesmo ultimoCodigo) → evita loop de duplicatas.
    const next = response.ultimoCodigo
    if (next === undefined || next === ultimoCodigo) break

    ultimoCodigo = next
    page++
  }

  return allResults
}
