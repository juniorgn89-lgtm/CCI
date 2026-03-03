import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { Venda, VendaItem, VendaResumo, VendaFormaPagamento } from '@/api/types/venda'

interface FetchVendasParams {
  turno?: number
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  modeloDocumento?: string
  tipoData?: 'EMISSAO' | 'ENTRADA'
  ultimoCodigo?: number
  limite?: number
  vendaCodigo?: number[]
  situacao?: 'A' | 'C' | 'T'
  vendasComDfe?: boolean
}

interface FetchVendaResumoParams {
  empresaCodigo?: number[]
  dataInicial?: string
  dataFinal?: string
  situacao?: 'A' | 'C' | 'T'
}

interface FetchVendaItensParams {
  empresaCodigo?: number
  usaProdutoLmc?: boolean
  dataInicial?: string
  dataFinal?: string
  tipoData?: 'EMISSAO' | 'ENTRADA'
  ultimoCodigo?: number
  limite?: number
  vendaCodigo?: number[]
}

interface FetchVendaFormasPagamentoParams {
  turno?: number
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  modeloDocumento?: string
  tipoData?: 'EMISSAO' | 'ENTRADA'
  ultimoCodigo?: number
  limite?: number
  vendaCodigo?: number[]
  situacao?: 'A' | 'C' | 'T'
  vendasComDfe?: boolean
}

export const fetchVendas = (params?: FetchVendasParams) =>
  client.get<PaginatedResponse<Venda>>('/VENDA', { params }).then((res) => res.data)

export const fetchVendaResumo = (params?: FetchVendaResumoParams) =>
  client.get<VendaResumo[]>('/VENDA_RESUMO', { params }).then((res) => res.data)

export const fetchVendaItens = (params?: FetchVendaItensParams) =>
  client.get<PaginatedResponse<VendaItem>>('/VENDA_ITEM', { params }).then((res) => res.data)

export const fetchVendaFormasPagamento = (params?: FetchVendaFormasPagamentoParams) =>
  client.get<PaginatedResponse<VendaFormaPagamento>>('/VENDA_FORMA_PAGAMENTO', { params }).then((res) => res.data)
