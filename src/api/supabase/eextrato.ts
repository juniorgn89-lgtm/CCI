import { supabase } from '@/lib/supabase'

/**
 * e-extrato (conciliadora de cartão) — chamadas à Edge Function `eextrato`.
 * As chaves ficam na função; daqui só sai o filtro. Os tipos espelham a
 * normalização de supabase/functions/_shared/eextrato.ts (mudou lá, muda aqui).
 */

export type TipoRetornoEextrato = 'venda' | 'vendaDetalhada' | 'pagamento' | 'ajuste' | 'recebivel' | 'dataPrevistaCredito'
export type StatusParcelaEextrato = 'PRE' | 'PAG' | 'ANT' | 'CAN' | 'CTP' | 'CPP'

export interface FiltroEextrato {
  dataVendaInicio?: string
  dataVendaFim?: string
  dataPagamentoInicio?: string
  dataPagamentoFim?: string
  dataCreditoInicio?: string
  dataCreditoFim?: string
  statusConciliacao?: number
}

interface BaseEextrato {
  dataVenda: string | null
  nsu: string | null
  autorizacao: string | null
  tid: string | null
  plano: number | null
  parcela: number | null
  rede: number | null
  bandeira: number | null
  produto: string | null
  codigoProduto: number | null
  numeroLote: string | null
  codigoLojaErp: string | null
  codigoEstabelecimento: string | null
  statusConciliacao: number | null
  modoCaptura: string | null
  horaVenda: string | null
  /** Nomes como a e-extrato manda (v9.3.11); preferidos ao código da tabela. */
  descricaoRede: string | null
  descricaoBandeira: string | null
  dataConciliacao: string | null
  dataCancelamento: string | null
}

export interface VendaEextrato extends BaseEextrato {
  dataCredito: string | null
  valorVenda: number | null
  taxaAdministracao: number | null
  valorTaxaAdministracao: number | null
  taxaAntecipacao: number | null
  numeroCartao: string | null
  maquinaLoja: string | null
  motivoConciliacao: string | null
  conciliadoManual: boolean | null
  valorParcela: number | null
  valorLiquidoParcela: number | null
  valorCancelado: number | null
  valorCanceladoPrevisto: number | null
  status: StatusParcelaEextrato | null
}

export interface AjusteEextrato extends BaseEextrato {
  dataCreditoDebito: string | null
  credito: number | null
  debito: number | null
  historico: number | null
  descricaoHistorico: string | null
  mesReferencia: string | null
  tipoProduto: string | null
  statusPagamento: string | null
}

/** Parcela com a data prevista do crédito (retorno 5.6): a agenda do que vai cair. */
export interface PrevisaoCreditoEextrato extends BaseEextrato {
  dataCredito: string | null
  valorBruto: number | null
  valorAdministracao: number | null
  valorAntecipacao: number | null
  valorLiquido: number | null
  taxaAdministracao: number | null
  status: StatusParcelaEextrato | null
}

export interface RecebivelEextrato {
  rede: number | null
  bandeira: number | null
  produto: string | null
  codigoProduto: number | null
  numeroLote: string | null
  codigoLojaErp: string | null
  codigoEstabelecimento: string | null
  statusConciliacao: number | null
  dataCreditoDebito: string | null
  credito: number | null
  debito: number | null
  historico: number | null
  tipoProduto: string | null
}

export interface ConsultaEextrato<T> { itens: T[]; paginas: number; completo: boolean }

const invocar = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.functions.invoke('eextrato', { body })
  if (error) {
    // A Edge Function devolve { error } no corpo; o supabase-js embrulha num FunctionsHttpError.
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    throw new Error(msg || error.message)
  }
  return data as T
}

/** A integração tem chave configurada no servidor? */
export const fetchEextratoStatus = () => invocar<{ configurado: boolean }>({ acao: 'status' })

/** Um retorno, todas as páginas (até o teto da função; `completo` diz se veio tudo). */
export const consultarEextrato = <T>(tipo: TipoRetornoEextrato, filtro: FiltroEextrato) =>
  invocar<ConsultaEextrato<T>>({ acao: 'consultar', tipo, filtro, todasPaginas: true })
