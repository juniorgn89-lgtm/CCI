import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { Produto, Grupo, ProdutoMeta, GrupoMeta } from '@/api/types/produto'

interface FetchProdutosParams {
  empresaCodigo?: number
  produtoCodigo?: number
  produtoCodigoExterno?: string
  grupoCodigo?: number
  ativo?: boolean
  usaProdutoLmc?: boolean
  ultimoCodigo?: number
  limite?: number
}

interface FetchGruposParams {
  grupoCodigoExterno?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchProdutoMetaParams {
  grupoMetaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

interface FetchGrupoMetaParams {
  ultimoCodigo?: number
  limite?: number
}

export const fetchProdutos = (params?: FetchProdutosParams) =>
  client.get<PaginatedResponse<Produto>>('/PRODUTO', { params }).then((res) => res.data)

export const fetchGrupos = (params?: FetchGruposParams) =>
  client.get<PaginatedResponse<Grupo>>('/GRUPO', { params }).then((res) => res.data)

export const fetchProdutoMeta = (params?: FetchProdutoMetaParams) =>
  client.get<PaginatedResponse<ProdutoMeta>>('/PRODUTO_META', { params }).then((res) => res.data)

export const fetchGrupoMeta = (params?: FetchGrupoMetaParams) =>
  client.get<PaginatedResponse<GrupoMeta>>('/GRUPO_META', { params }).then((res) => res.data)
