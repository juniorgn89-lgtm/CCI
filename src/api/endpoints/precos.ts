import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { TabelaPrecoPrazo } from '@/api/types/precos'

interface FetchTabelaPrecoPrazoParams {
  tabelaPrecoPrazoCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

/**
 * "Tabela de Preço de Prazos" (BARATAO, TABACARIA, …). Cada resultado é uma
 * tabela com suas linhas de preço especial aninhadas (`precoEspecialItem`).
 * READ-ONLY: só o GET; o PATCH /{id} do mesmo grupo é ignorado por design.
 */
export const fetchTabelaPrecoPrazo = (params?: FetchTabelaPrecoPrazoParams) =>
  client
    .get<PaginatedResponse<TabelaPrecoPrazo>>('/TABELA_PRECO_PRAZO', { params })
    .then((res) => res.data)
