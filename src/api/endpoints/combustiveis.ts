import { client } from '@/api/client'
import type {
  Abastecimento,
  Tanque,
  Bico,
  Bomba,
  LMC,
  TrocaPreco,
} from '@/api/types/combustivel'

interface FetchAbastecimentosParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchTanquesParams {
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

interface FetchBicosParams {
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

interface FetchBombasParams {
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

interface FetchLmcParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchTrocaPrecoParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
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
  client.get<LMC[]>('/LMC', { params }).then((res) => res.data)

export const fetchTrocaPreco = (params?: FetchTrocaPrecoParams) =>
  client.get<TrocaPreco[]>('/TROCA_PRECO', { params }).then((res) => res.data)
