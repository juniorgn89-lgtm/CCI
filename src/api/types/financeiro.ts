export interface TituloReceber {
  codigo: number
  empresaCodigo: number
  tituloCodigo: number
  dataMovimento: string
  dataVencimento: string
  valor: number
  vendaCodigo: number
  duplicataCodigo: number
  tipo: string
  pendente: boolean
  clienteCodigo: number
  dataPagamento: string
  planoContaGerencialCodigo: number
  nomeCliente: string
  cpfCnpjCliente: string
  convertido: boolean
  documento: string
  tituloNumero: number
}

export interface TituloPagarPagamento {
  pagamentoCodigo: number
  tipo: string
  detalhe: string
  valor: number
  dataPagamento: string
  codigoDocumento: string
  tipoDocumento: string
}

export interface TituloPagar {
  codigo: number
  empresaCodigo: number
  tituloPagarCodigo: number
  notaEntradaCodigo: number
  dataMovimento: string
  vencimento: string
  dataPagamento: string
  situacao: string
  tipo: string
  tipoLancamento: string
  valor: number
  valorPago: number
  desconto: number
  acrescimo: number
  cheque: number
  dinheiro: number
  troco: number
  adiantamento: number
  cartao: number
  fornecedorCodigo: number
  planoContaGerencialCodigo: number
  descricao: string
  numeroTitulo: string
  nomeFornecedor: string
  cpfCnpjFornecedor: string
  pagamento: TituloPagarPagamento[]
  numeroRemessa: number
  planoContaGerencialNivel: string
  planoContaGerencialDescricao: string
  centroCustoCodigo: number
  centroCustoDescricao: string
  parcela: number
  quantidadeParcelas: number
  linhaDigitavel: string
  autorizado: boolean
  nossoNumero: string
  bancoFornecedor: string
  agenciaFornecedor: string
  contaFornecedor: string
  tipoChavePixFornecedor: string
  chavePixFornecedor: string
  qrCodePix: string
  tipoTributo: string
  codigoReceitaTributo: number
  renavam: string
  placa: string
  codigoMunicipio: number
  digitoFgts: number
  lacreConSocialFgts: number
  identificadorFgts: number
}

export interface DuplicataPagamento {
  recebimentoCodigo: number
  tipo: string
  detalhe: string
  valor: number
  dataRecebimento: string
}

export interface Duplicata {
  codigo: number
  empresaCodigo: number
  duplicataCodigo: number
  dataPagamento: string
  valorPago: number
  pendente: boolean
  dataMovimento: string
  vencimento: string
  clienteCodigo: number
  valorDuplicata: number
  situacao: string
  valorAcrescimo: number
  valorDesconto: number
  valorLiquido: number
  numeroDocumento: string
  nossoNumero: string
  nomeCliente: string
  cpfCnpjCliente: string
  pagamento: DuplicataPagamento[]
  remessaBoleto: string
  hierarquiaPlanoConta: string
  planoContaGerencialCodigo: number
}

export interface MovimentoConta {
  codigo: number
  empresaCodigo: number
  movimentoContaCodigo: number
  valor: number
  dataMovimento: string
  descricao: string
  tipoDocumentoOrigem: string
  codigoTipoDocumentoOrigem: number
  documentoOrigemCodigo: number
  tipo: string
  conciliado: boolean
  evento: string
  saldo: number
  contaCodigo: number
  planoContaGerencialCodigo: number
  centroCustoCodigo: number
  documento: string
  lote: string
  daraHoraConciliacao: string
  usuarioConciliacao: string
  codigoPessoa: number
  tipoPessoa: string
}

export interface Caixa {
  codigo: number
  empresaCodigo: number
  caixaCodigo: number
  dataMovimento: string
  turnoCodigo: number
  turno: string
  pdvCodigo: number
  funcionarioCodigo: number
  centroCusto: number
  abertura: string
  fechamento: string
  fechado: boolean
  consolidado: boolean
  tipoInclusao: string
  bloqueado: boolean
  tipoBloqueio: string
  apurado: number
  diferenca: number
}

/**
 * Apresentado vs Apurado por caixa, quebrado por forma de pagamento — espelha o
 * "Fechamento de Caixa" do webPosto. Uma linha por caixa; cada forma tem o trio
 * `{forma}Apresentado` (conferido), `{forma}Apurado` (sistema) e `{forma}Diferenca`.
 */
export interface CaixaApresentado {
  codigo: number
  empresaCodigo: number
  caixaCodigo: number
  consolidado: boolean
  dinheiroApresentado: number
  dinheiroApurado: number
  dinheiroDiferenca: number
  notaPrazoApresentado: number
  notaPrazoApurado: number
  notaPrazoDiferenca: number
  chequeApresentado: number
  chequeApurado: number
  chequeDiferenca: number
  chequePreApresentado: number
  chequePreApurado: number
  chequePreDiferenca: number
  cartaoApresentado: number
  cartaoApurado: number
  cartaoDiferenca: number
  cartaoFreteApresentado: number
  cartaoFreteApurado: number
  cartaoFreteDiferenca: number
  valeClienteApresentado: number
  valeClienteApurado: number
  valeClienteDiferenca: number
  emprestimoApresentado: number
  emprestimoApurado: number
  emprestimoDiferenca: number
  prePagApresentado: number
  prePagApurado: number
  prePagDiferenca: number
  despesaApresentado: number
  despesaApurado: number
  despesaDiferenca: number
  valeFunApresentado: number
  valeFunApurado: number
  valeFunDiferenca: number
  chequePagarApresentado: number
  chequePagarApurado: number
  chequePagarDiferenca: number
  transfBancApresentado: number
  transfBancApurado: number
  transfBancDiferenca: number
  transfDebApresentado: number
  transfDebApurado: number
  transfDebDiferenca: number
  fundoCxDebApresentado: number
  fundoCxDebApurado: number
  fundoCxDebDiferenca: number
  valeCliente: number
  suprimentoCaixa: number
  recebimentoCaixa: number
  chequeTroco: number
  servicoCaixa: number
  prePagoCredito: number
  fundoCaixaCredito: number
  ordemPagamento: number
  pagamentoCaixa: number
  saidaTrocaValor: number
}

/** Formas de pagamento do /CAIXA_APRESENTADO, com rótulo do webPosto. */
export const CAIXA_APRESENTADO_FORMAS: { key: string; nome: string }[] = [
  { key: 'dinheiro', nome: 'Dinheiro' },
  { key: 'cartao', nome: 'Cartão' },
  { key: 'transfBanc', nome: 'Transf. Crédito' },
  { key: 'transfDeb', nome: 'Transf. Débito' },
  { key: 'notaPrazo', nome: 'A Prazo' },
  { key: 'cheque', nome: 'Cheque' },
  { key: 'chequePre', nome: 'Cheque Pré' },
  { key: 'cartaoFrete', nome: 'Cartão Frete' },
  { key: 'valeCliente', nome: 'Vale Cliente' },
  { key: 'valeFun', nome: 'Vale Funcionário' },
  { key: 'emprestimo', nome: 'Empréstimo' },
  { key: 'prePag', nome: 'Pré-Pago' },
  { key: 'despesa', nome: 'Despesa' },
  { key: 'chequePagar', nome: 'Cheque a Pagar' },
  { key: 'fundoCxDeb', nome: 'Fundo Caixa Déb.' },
]

export interface Conta {
  codigo: number
  empresaCodigo: number
  contaCodigo: number
  descricao: string
  saldoAtual: number
  ativo: boolean
  usaOfx: boolean
}
