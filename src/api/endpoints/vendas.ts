import { client } from '@/api/client'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
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

/**
 * Conjunto de `vendaCodigo` CANCELADOS no período (situacao='C').
 *
 * O `/VENDA_ITEM` NÃO retorna o flag `cancelada` (nem aceita `situacao`), então
 * filtrar item por `it.cancelada` é no-op e os cancelados vazam pros totais —
 * divergência vs BI, que conta só `cancelada="N"`. Cruzamos com o `/VENDA`
 * (que sabe a situação da venda) e excluímos os itens cujo `vendaCodigo` está
 * neste set. Cancelados são subconjunto pequeno, então o custo é baixo.
 */
export const fetchVendaCodigosCancelados = async (params: {
  empresaCodigo?: number
  dataInicial?: string
  dataFinal?: string
  tipoData?: 'EMISSAO' | 'ENTRADA'
}): Promise<Set<number>> => {
  const vendas = await fetchAllPages(
    (p) => fetchVendas({ ...params, situacao: 'C', ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
    1000,
    200,
  )
  const set = new Set<number>()
  for (const v of vendas) if (v.vendaCodigo != null) set.add(v.vendaCodigo)
  return set
}

export const fetchVendaFormasPagamento = (params?: FetchVendaFormasPagamentoParams) =>
  client.get<PaginatedResponse<VendaFormaPagamento>>('/VENDA_FORMA_PAGAMENTO', { params }).then((res) => res.data)
