import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { Compra, FornecedorErp } from '@/api/types/compra'

interface FetchComprasParams {
  empresaCodigo?: number[]
  dataInicial: string
  dataFinal: string
  ultimoCodigo?: number
  limite?: number
}

/** Cabeçalhos de nota de entrada (GET /COMPRA). Fonte do fornecedor de cada compra. */
export const fetchCompras = (params: FetchComprasParams) =>
  client.get<PaginatedResponse<Compra>>('/COMPRA', { params }).then((res) => res.data)

/** Cadastro de fornecedores do ERP (GET /FORNECEDOR). Sem filtro de data: é o cadastro inteiro. */
export const fetchFornecedoresErp = (params: { ultimoCodigo?: number; limite?: number }) =>
  client.get<PaginatedResponse<FornecedorErp>>('/FORNECEDOR', { params }).then((res) => res.data)
