export interface Abastecimento {
  codigo: number
  dataFiscal: string
  horaFiscal: string
  codigoBico: number
  codigoProduto: number
  quantidade: number
  valorUnitario: number
  valorTotal: number
  codigoFrentista: number
  afericao: boolean
  vendaItemCodigo: number
  precoCadastro: number
  tabelaPrecoA: number
  tabelaPrecoB: number
  tabelaPrecoC: number
  empresaCodigo: number
  dataHoraAbastecimento: string
  stringAll: string
  placa: string
  abastecimentoCodigo: number
  encerrante: number
}

export interface Tanque {
  codigo: number
  empresaCodigo: number
  tanqueCodigo: number
  tanqueCodigoExterno: string
  name: string
  produtoCodigo: number
  capacidade: number
  ultimoUsuarioAlteracao: string
  lastro: number
  estoqueEscritural: number
  produtoLmcCodigo: number
  dataHoraMedidor: string
}

export interface Bico {
  codigo: number
  empresaCodigo: number
  bicoCodigo: number
  bicoNumero: string
  tanqueCodigo: number
  bombaCodigo: number
  produtoCodigo: number
  ultimoUsuarioAlteracao: string
  produtoLmcCodigo: number
}

export interface BombaLacre {
  numeroLacre: string
  dataAplicacao: string
}

export interface Bomba {
  codigo: number
  bombaCodigo: number
  empresaCodigo: number
  bombaReferencia: string
  descricao: string
  quantidadeBicos: number
  ilha: number
  serie: string
  fabricante: string
  modelo: string
  tipoMedicaoDigital: boolean
  lacres: BombaLacre[]
}

export interface LmcTanque {
  lmcTanqueCodigo: number
  tanqueCodigo: number
  abertura: number
  escritural: number
  fechamento: number
}

export interface LmcBico {
  lmcBicoCodigo: number
  bicoCodigo: number
  tanqueCodigo: number
  bombaCodigo: number
  abertura: number
  fechamento: number
  afericao: number
  venda: number
}

export interface LmcNota {
  compraCodigo: number
  numeroNota: string
  dataEntrada: string
  volumeRecebido: number
  tanqueCodigo: number
}

export interface LMC {
  codigo: number
  empresaCodigo: number
  lmcCodigo: number
  produtoCodigo: number[]
  dataMovimento: string
  abertura: number
  entrada: number
  saida: number
  perdaSobra: number
  escritural: number
  fechamento: number
  disponivel: number
  ultimoUsuarioAlteracao: string
  saldo: number
  precoCusto: number
  produtoLmcCodigo: number
  lmcTanque: LmcTanque[]
  lmcBico: LmcBico[]
  lmcNota: LmcNota[]
}

export interface TrocaPrecoItem {
  codigoProduto: number
  custo: number
  precoA: number
  novoPrecoA: number
  percMarkupA: number
  precoB: number
  novoPrecoB: number
  percMarkupB: number
  precoC: number
  novoPrecoC: number
  percMarkupC: number
}

export interface TrocaPreco {
  codigo: number
  empresaCodigo: number
  trocaPrecoCodigo: number
  tipoAlteracao: string
  data: string
  hora: string
  turno: string
  realizada: boolean
  precoItens: TrocaPrecoItem[]
}
