import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type {
  TituloReceber,
  TituloPagar,
  Duplicata,
  MovimentoConta,
  DRE,
  Caixa,
  Conta,
} from '@/api/types/financeiro'

interface FetchTitulosReceberParams {
  dataInicial: string
  dataFinal: string
  turno?: number
  empresaCodigo?: number
  dataHoraAtualizacao?: string
  apenasPendente?: boolean
  codigoDuplicata?: number
  dataFiltro?: 'MOVIMENTO' | 'VENCIMENTO' | 'PAGAMENTO'
  ultimoCodigo?: number
  limite?: number
  convertido?: boolean
  vendaCodigo?: number[]
}

interface FetchTitulosPagarParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  tipoData?: 'EMISSAO' | 'ENTRADA'
  ultimoCodigo?: number
  limite?: number
}

interface FetchDuplicatasParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchMovimentosContaParams {
  empresaCodigo?: number
  contaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchDreParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
}

interface FetchCaixasParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  ultimoCodigo?: number
  limite?: number
}

interface FetchContasParams {
  empresaCodigo?: number
  ultimoCodigo?: number
  limite?: number
}

export const fetchTitulosReceber = (params?: FetchTitulosReceberParams) =>
  client.get<PaginatedResponse<TituloReceber>>('/TITULO_RECEBER', { params }).then((res) => res.data)

export const fetchTitulosPagar = (params?: FetchTitulosPagarParams) =>
  client.get<PaginatedResponse<TituloPagar>>('/TITULO_PAGAR', { params }).then((res) => res.data)

export const fetchDuplicatas = (params?: FetchDuplicatasParams) =>
  client.get<PaginatedResponse<Duplicata>>('/DUPLICATA', { params }).then((res) => res.data)

export const fetchMovimentosConta = (params?: FetchMovimentosContaParams) =>
  client.get<PaginatedResponse<MovimentoConta>>('/MOVIMENTO_CONTA', { params }).then((res) => res.data)

export const fetchDre = (params?: FetchDreParams) =>
  client.get<DRE>('/DRE', { params }).then((res) => res.data)

export const fetchCaixas = (params?: FetchCaixasParams) =>
  client.get<PaginatedResponse<Caixa>>('/CAIXA', { params }).then((res) => res.data)

export const fetchContas = (params?: FetchContasParams) =>
  client.get<PaginatedResponse<Conta>>('/CONTA', { params }).then((res) => res.data)
