export interface Abastecimento {
  codigo: number
  empresaCodigo: number
  bicoCodigo: number
  produtoCodigo: number
  funcionarioCodigo: number
  dataHora: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  encerrante: number
  precoA: number
  precoB: number
  precoC: number
}

export interface Tanque {
  codigo: number
  empresaCodigo: number
  produtoCodigo: number
  descricao: string
  capacidade: number
}

export interface Bico {
  codigo: number
  empresaCodigo: number
  tanqueCodigo: number
  bombaCodigo: number
  descricao: string
}

export interface Bomba {
  codigo: number
  empresaCodigo: number
  descricao: string
  quantidadeBicos: number
}

export interface LMC {
  codigo: number
  empresaCodigo: number
  data: string
  estoqueFinal: number
  volumeVendido: number
}

export interface TrocaPreco {
  codigo: number
  empresaCodigo: number
  produtoCodigo: number
  dataHora: string
  precoAnterior: number
  precoNovo: number
  precoCompra: number
}
