export interface Funcionario {
  codigo: number
  funcionarioCodigo: number
  nome: string
  empresaCodigo: number
  funcaoCodigo: number
  codigoExterno: string
  dataAdmissao: string
  dataDemissao: string
  ativo: boolean
}

export interface FuncionarioMeta {
  codigo: number
  funcionarioMetaCodigo: number
  funcionarioCodigo: number
  empresaCodigo: number
  descricao: string
  valor: number
  dataInicial: string
  dataFinal: string
}

export interface Funcao {
  codigo: number
  funcaoCodigo: number
  /** Nome do cargo (campo REAL da API — ex.: "FRENTISTA", "CAIXA."). */
  nome: string
  /** @deprecated A API não retorna este campo; use `nome`. */
  descricao?: string
}

export interface Placares {
  codigo: number
  empresaCodigo: number
  funcionarioCodigo: number
  dataInicial: string
  dataFinal: string
  totalVendas: number
  quantidadeVendas: number
  ticketMedio: number
  taxaConversao: number
}

export interface ProdutividadeFuncionario {
  funcionarioCodigo: number
  funcionarioNome: string
  empresaCodigo: number
  totalVendas: number
  quantidadeVendas: number
  ticketMedio: number
  taxaConversao: number
}
