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

export interface TituloPagar {
  codigo: number
  empresaCodigo: number
  fornecedorCodigo: number
  dataMovimento: string
  dataVencimento: string
  dataPagamento: string
  valorOriginal: number
  valorPago: number
  valorAberto: number
  situacao: string
}

export interface Duplicata {
  codigo: number
  empresaCodigo: number
  numeroDuplicata: string
  dataEmissao: string
  dataVencimento: string
  valor: number
  valorPago: number
  situacao: string
}

export interface MovimentoConta {
  codigo: number
  empresaCodigo: number
  contaCodigo: number
  data: string
  valor: number
  tipo: string
  descricao: string
  tipoDocumentoOrigem: string
}

export interface DreApuracaoReceita {
  descricao: string
  valor: number
}

export interface DreApuracaoPagamentos {
  descricao: string
  valor: number
}

export interface DreVendasGrupo {
  descricao: string
  valor: number
}

export interface DRE {
  apuracaoReceita: DreApuracaoReceita[]
  apuracaoPagamentos: DreApuracaoPagamentos[]
  vendasGrupo: DreVendasGrupo[]
}

export interface Caixa {
  codigo: number
  empresaCodigo: number
  data: string
  turno: number
  abertura: number
  fechamento: number
  consolidado: boolean
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
  banco: string
  agencia: string
  numeroConta: string
  ativo: boolean
}
