import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type {
  Abastecimento,
  Tanque,
  Bico,
  Bomba,
  LMC,
  TrocaPreco,
} from '@/api/types/combustivel'

interface FetchAbastecimentosParams {
  dataInicial: string
  dataFinal: string
  tipoData?: 'EMISSAO' | 'ENTRADA'
  ultimoCodigo?: number
  limite?: number
}

interface FetchTanquesParams {
  tanqueCodigo?: number
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

interface FetchBicosParams {
  bicoCodigo?: number
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

interface FetchBombasParams {
  bombaCodigo?: number
  empresaCodigo?: number
}

interface FetchLmcParams {
  empresaCodigo?: number[]
  dataInicial: string
  dataFinal: string
  vendaCodigo?: number
  ultimoCodigo?: number
  limite?: number
  quitado?: boolean
  dataHoraAtualizacao?: string
  origem?: 'C' | 'D' | 'V'
}

interface FetchTrocaPrecoParams {
  dataInicial: string
  dataFinal: string
  realizada?: boolean
  tipoProduto?: string
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

export const fetchAbastecimentos = (params?: FetchAbastecimentosParams) =>
  client.get<Abastecimento[]>('/ABASTECIMENTO', { params }).then((res) => res.data)

export const fetchTanques = (params?: FetchTanquesParams) =>
  client.get<Tanque[]>('/TANQUE', { params }).then((res) => res.data)

export const fetchBicos = (params?: FetchBicosParams) =>
  client.get<Bico[]>('/BICO', { params }).then((res) => res.data)

export const fetchBombas = (params?: FetchBombasParams) =>
  client.get<Bomba[]>('/BOMBA', { params }).then((res) => res.data)

export const fetchLmc = (params?: FetchLmcParams) =>
  client.get<PaginatedResponse<LMC>>('/LMC', { params }).then((res) => res.data)

export const fetchTrocaPreco = (params?: FetchTrocaPrecoParams) =>
  client.get<PaginatedResponse<TrocaPreco>>('/TROCA_PRECO', { params }).then((res) => res.data)
