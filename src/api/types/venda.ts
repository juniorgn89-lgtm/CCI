export interface VendaItemEstoque {
  produtoCodigo: number
  estoqueCodigo: number
}

export interface VendaItem {
  codigo: number
  empresaCodigo: number
  vendaCodigo: number
  vendaItemCodigo: number
  dataMovimento: string
  produtoCodigo: number
  quantidade: number
  precoCusto: number
  totalCusto: number
  precoVenda: number
  totalVenda: number
  totalDesconto: number
  totalAcrescimo: number
  /** "N" = válida, "S" = cancelada. Canceladas são excluídas (conta só cancelada="N").
   *  Opcional porque nem todo payload/contexto traz — ausente = tratado como válida. */
  cancelada?: string
  bicoCodigo: number
  tanqueCodigo: number
  produtoLmcCodigo: number
  funcionarioCodigo: number
  produtoKitCodigo: number
  controleItem: number
  icmsValor: number
  icmsBase: number
  icmsAliquota: number
  cfop: string
  cst: string
  produtoCodigoExterno: string
  cstPis: string
  aliquotaPis: number
  basePis: number
  valorPis: number
  cstCofins: string
  aliquotaCofins: number
  baseCofins: number
  valorCofins: number
  tributacaoAdRem: number
  valorTributacaoAdRem: number
  totalVendaBruto: number
  totalDescontoBruto: number
  totalAcrescimoBruto: number
  precoVendaBruto: number
  cstCbs: string
  classTributariaCbs: string
  bcCbs: number
  aliquotaEfetivaCbs: number
  valorCbs: number
  cstIbs: string
  classTributariaIbs: string
  bcIbs: number
  aliquotaEfetivaIbs: number
  valorIbs: number
  aliquotaAdRemCbs: number
  valorAdRemCbs: number
  aliquotaAdRemIbs: number
  valorAdRemIbs: number
  aliquotaCbs: number
  aliquotaIbs: number
}

// Item aninhado dentro de /VENDA (inclui estoque)
export interface VendaItemNested extends VendaItem {
  estoque: VendaItemEstoque[]
}

export interface VendaTroco {
  valorTroco: number
  tipoTroco: string
}

// Resposta de GET /VENDA_FORMA_PAGAMENTO (endpoint separado)
export interface VendaFormaPagamento {
  codigo: number
  empresaCodigo: number
  vendaCodigo: number
  vendaPrazoCodigo: number
  dataMovimento: string
  vencimento: string
  valorPagamento: number
  taxaPercentual: number
  formaPagamentoCodigo: number
  administradoraCodigo: number
  turnoCodigo: number
  tipoFormaPagamento: string
  nomeFormaPagamento: string
}

// Forma de pagamento aninhada dentro de /VENDA (inclui campos extras)
export interface VendaFormaPagamentoNested extends VendaFormaPagamento {
  gestora: string
  bandeira: string
  tipoTransacao: string
  autorizacao: string
  numeroCartao: string
  nsu: string
  administradoraCodigoExterno: string
}

export interface Venda {
  codigo: number
  empresaCodigo: number
  vendaCodigo: number
  notaCodigo: number
  funcionarioCodigo: number
  clienteCodigo: number
  destacaAcrescimoDesconto: number
  clienteCpfCnpj: string
  dataHora: string
  notaNumero: string
  notaSerie: string
  totalVenda: number
  caixaCodigo: number
  notaChave: string
  modeloDocumento: string
  cancelada: string
  placaVeiculo: string
  clienteCodigoExterno: string
  centroCustoCodigo: number
  centroCustoVeiculo: string
  identificacaoFidelidade: string
  motoristaCodigo: number
  troco: VendaTroco[]
  itens: VendaItemNested[]
  formaPagamento: VendaFormaPagamentoNested[]
}

export interface VendaResumo {
  codigoEmpresa: number
  data: string
  modelo: string
  quantidade: number
  total: number
}
