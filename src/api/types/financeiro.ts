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

export interface CaixaApresentado {
  codigo: number
  empresaCodigo: number
  caixaCodigo: number
  formaPagamentoCodigo: number
  valor: number
  descricao: string
}

export interface Conta {
  codigo: number
  empresaCodigo: number
  contaCodigo: number
  descricao: string
  saldoAtual: number
  ativo: boolean
  usaOfx: boolean
}
