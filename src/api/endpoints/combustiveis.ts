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
  tipoData?: 'EMISSAO' | 'ENTRADA' | 'FISCAL' | 'MOVIMENTO'
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
  client.get<PaginatedResponse<Abastecimento>>('/ABASTECIMENTO', { params }).then((res) => res.data)

export const fetchTanques = (params?: FetchTanquesParams) =>
  client.get<PaginatedResponse<Tanque>>('/TANQUE', { params }).then((res) => res.data)

export const fetchBicos = (params?: FetchBicosParams) =>
  client.get<PaginatedResponse<Bico>>('/BICO', { params }).then((res) => res.data)

export const fetchBombas = (params?: FetchBombasParams) =>
  client.get<PaginatedResponse<Bomba>>('/BOMBA', { params }).then((res) => res.data)

export const fetchLmc = (params?: FetchLmcParams) =>
  client.get<PaginatedResponse<LMC>>('/LMC', { params }).then((res) => res.data)

interface FetchCompraItemParams {
  empresaCodigo?: number[]
  dataInicial: string
  dataFinal: string
  ultimoCodigo?: number
  limite?: number
}

/** Item de nota de entrada (compra) — POR PRODUTO. Fonte da "última compra":
 * reflete a NF assim que CADASTRADA (antes da escrituração no LMC) e liga ao
 * produto (→ tanque). NÃO há flag de cancelamento: uma NF cancelada some daqui,
 * então itens cancelados já ficam de fora naturalmente. Só tipamos o que usamos. */
export interface CompraItem {
  empresaCodigo: number
  compraCodigo: number
  produtoCodigo: number
  /** Volume/quantidade comprado do produto (L). */
  quantidade: number
  /** Custo unitário (R$/L). */
  precoCusto: number
  /** Data de entrada da nota (yyyy-MM-dd...). */
  dataEntrada: string
}

export const fetchCompraItem = (params?: FetchCompraItemParams) =>
  client.get<PaginatedResponse<CompraItem>>('/COMPRA_ITEM', { params }).then((res) => res.data)

export const fetchTrocaPreco = (params?: FetchTrocaPrecoParams) =>
  client.get<PaginatedResponse<TrocaPreco>>('/TROCA_PRECO', { params }).then((res) => res.data)
