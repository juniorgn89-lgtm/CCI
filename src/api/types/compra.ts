/**
 * Cabeçalho de nota de entrada (compra) — /COMPRA. Só tipamos o que usamos:
 * o elo nota → fornecedor, que o /COMPRA_ITEM não traz. Junto com os itens
 * (compraCodigo) dá "o que cada fornecedor já entregou".
 */
export interface Compra {
  empresaCodigo: number
  compraCodigo: number
  notaEntradaCodigo: number
  dataMovimento: string
  dataEntrada: string
  notaNumero: string | null
  fornecedorCodigo: number | null
  cnpjCpfFornecedor: string | null
  valorTotal: number
  usoConsumo: boolean
}
