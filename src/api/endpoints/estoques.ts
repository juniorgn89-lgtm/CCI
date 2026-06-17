import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { ProdutoEstoque, ProdutoEstoqueExtrato, Estoque, EstoquePeriodo, ContagemEstoque } from '@/api/types/estoque'

interface FetchProdutoEstoqueParams {
  empresaCodigo: number
  dataHora?: string
  grupoCodigo?: number[]
  produtoCodigo?: number[]
  ultimoCodigo?: number
  limite?: number
}

interface FetchProdutoEstoqueExtratoParams {
  empresaCodigo?: number
  produtoCodigo?: number
  dataInicial?: string
  dataInicialCompra?: string
  /** false = não traz histórico/última entrada (payload leve). */
  exibeHistoricoCompra?: boolean
  ultimoCodigo?: number
  limite?: number
}

interface FetchEstoqueParams {
  empresaCodigo?: number
  dataHoraAtualizacao?: string
  estoqueCodigo?: number
  estoqueCodigoExterno?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchEstoquePeriodoParams {
  dataFinal: string
  empresaCodigo?: number
  dataHoraAtualizacao?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchContagemEstoqueParams {
  dataContagem: string
  contagemReferencia?: number
  ultimoCodigo?: number
  limite?: number
}

export const fetchProdutoEstoque = (params?: FetchProdutoEstoqueParams) =>
  client.get<PaginatedResponse<ProdutoEstoque>>('/PRODUTO_ESTOQUE', { params }).then((res) => res.data)

export const fetchProdutoEstoqueExtrato = (params?: FetchProdutoEstoqueExtratoParams) =>
  client.get<PaginatedResponse<ProdutoEstoqueExtrato>>('/PRODUTO_ESTOQUE_EXTRATO', { params }).then((res) => res.data)

export const fetchEstoque = (params?: FetchEstoqueParams) =>
  client.get<PaginatedResponse<Estoque>>('/ESTOQUE', { params }).then((res) => res.data)

export const fetchEstoquePeriodo = (params?: FetchEstoquePeriodoParams) =>
  client.get<PaginatedResponse<EstoquePeriodo>>('/ESTOQUE_PERIODO', { params }).then((res) => res.data)

export const fetchContagemEstoque = (params?: FetchContagemEstoqueParams) =>
  client.get<PaginatedResponse<ContagemEstoque>>('/CONTAGEM_ESTOQUE', { params }).then((res) => res.data)
