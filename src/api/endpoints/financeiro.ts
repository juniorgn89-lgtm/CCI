import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type {
  TituloReceber,
  TituloPagar,
  Duplicata,
  MovimentoConta,
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
  dataInicial?: string
  dataFinal?: string
  dataHoraAtualizacao?: string
  apenasPendente?: boolean
  dataFiltro?: 'MOVIMENTO' | 'VENCIMENTO' | 'PAGAMENTO'
  ultimoCodigo?: number
  limite?: number
  empresaCodigo?: number
  notaEntradaCodigo?: number
  tituloPagarCodigo?: number
  fornecedorCodigo?: number
  linhaDigitavel?: string
  autorizado?: boolean
  tipoLancamento?: 'BOLETO' | 'TRIBUTO' | 'CREDITO_CONTA' | 'TED' | 'DOC' | 'PIX' | 'LANCAMENTO_MANUAL' | 'CONVENIO'
}

interface FetchDuplicatasParams {
  dataInicial?: string
  dataFinal?: string
  dataHoraAtualizacao?: string
  apenasPendente?: boolean
  dataFiltro?: 'MOVIMENTO' | 'VENCIMENTO' | 'PAGAMENTO'
  ultimoCodigo?: number
  limite?: number
  empresaCodigo?: number
  notaEntradaCodigo?: number
  tituloPagarCodigo?: number
  fornecedorCodigo?: number
  linhaDigitavel?: string
  autorizado?: boolean
  tipoLancamento?: 'BOLETO' | 'TRIBUTO' | 'CREDITO_CONTA' | 'TED' | 'DOC' | 'PIX' | 'LANCAMENTO_MANUAL' | 'CONVENIO'
}

interface FetchMovimentosContaParams {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  ultimoCodigo?: number
  limite?: number
  mostraSaldo?: boolean
  dataHoraAtualizacao?: string
  documentoOrigemCodigo?: number
  tipoDocumentoOrigem?: string
  contaCodigo?: number
}

interface FetchCaixasParams {
  dataInicial: string
  dataFinal: string
  turno?: number
  empresaCodigo?: number
  individual?: boolean
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

export const fetchCaixas = (params?: FetchCaixasParams) =>
  client.get<PaginatedResponse<Caixa>>('/CAIXA', { params }).then((res) => res.data)

export const fetchContas = (params?: FetchContasParams) =>
  client.get<PaginatedResponse<Conta>>('/CONTA', { params }).then((res) => res.data)
