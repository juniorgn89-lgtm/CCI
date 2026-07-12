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

/** Recebível de cartão (/INTEGRACAO/CARTAO) — a vencer/recebido por administradora. */
export interface Cartao {
  empresaCodigo: number
  cartaoCodigo: number
  vendaCodigo: number
  vencimento: string
  valor: number
  parcela: number
  taxaPercentual: number
  administradoraCodigo: number
  /** ATENÇÃO: a API escreve o campo com "i" a mais (typo deles). */
  adiministradoraDescricao: string
  clienteReferencia: string
  clienteRazao: string
  clienteCpfCnpj: string
  centroCustoCodigo: number
  centroCustoDescricao: string
  dataPagamento: string
  tipoInclusao: string
  dataMovimento: string
  horaMovimento: string
  dataFiscal: string
  pendente: boolean
  nsu: string
  autorizacao: string
  codigo: number
  codigoBandeira: string
  nsuTef: string
}

/**
 * Cadastro de administradora/bandeira de cartão (/INTEGRACAO/ADMINISTRADORA).
 * Fonte da VERDADE pra classificar a modalidade (`tipo`) — o /CARTAO não traz
 * débito/crédito, só a descrição. Join por `administradoraCodigo`. Também expõe
 * a taxa fixa por transação (`taxaTransacao`) e a de antecipação contratada.
 */
export interface Administradora {
  empresaCodigo: number
  administradoraCodigo: number
  descricao: string
  /** "Débito" | "Crédito" | "Carteira Digital" | "PIX" | "Vale" (cadastro real). */
  tipo: string
  /** Taxa contratada (%) — a praticada no recebível vem do /CARTAO.taxaPercentual. */
  percentualComissao: number
  percentualAntecipacao: number
  /** Tarifa FIXA por transação (R$) — a coluna "Transação" do WebPosto. */
  taxaTransacao: number
  ativo: boolean
  codigo: number
}

/**
 * Repasse do adquirente (EDI) — /INTEGRACAO/CARTAO_REMESSA. Lote de repasse por
 * administradora e dia de LIQUIDAÇÃO. Campos confirmados em sondagem ao vivo.
 *
 * Conciliação: cruza com /CARTAO buscado por `dataFiltro='PAGAMENTO'` — o
 * `dataRemessa` (dia do repasse) casa com o `dataPagamento` do recebível
 * (validado: Σ valorRemessa == Σ /CARTAO.valor por administradora×dia, Δ 0,00).
 * Read-only; nada é escrito.
 */
export interface CartaoRemessa {
  cartaoRemessaCodigo: number
  cartaoRemessaReferenciaCodigo: string
  empresaCodigo: number
  /** Bruto do lote repassado (antes da taxa). Casa com Σ /CARTAO.valor do dia. */
  valorRemessa: number
  /** Dia do repasse/liquidação — casa com o `dataPagamento` do /CARTAO. */
  dataRemessa: string
  dataPagamento: string
  dataRecebimento: string
  /** Descrição da bandeira/administradora (idêntica à do /CARTAO). */
  administradora: string
  /** Taxa/despesa do lote em R$ (bruto − líquido) — NÃO é percentual. */
  taxasDespesas: number
  valorLiquido: number
  administradoraCodigo: number
  acrescimos: number
  codigo: number
}

/** Conta de cartão a pagar (/INTEGRACAO/CARTAO_PAGAR). */
export interface CartaoPagar {
  empresaCodigo: number
  cartaoCompraCodigo: number
  cartaoPagarCodigo: number
  dataMovimento: string
  dataVencimento: string
  dataPagamento: string
  valor: number
  centroCustoCodigo: number
  planoContaGerencialCodigo: number
  situacao: string
  descricao: string
  autorizacao: string
  codigo: number
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
