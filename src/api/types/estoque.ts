export interface SaldoEstoque {
  estoqueCodigo: number
  estoqueNome: string
  quantidade: number
}

export interface ProdutoEstoque {
  codigo: number
  empresaCodigo: number
  produtoCodigo: number
  saldo: number
  estoqueCodigo: number
  saldoEstoque: SaldoEstoque[] | null
}

export interface Estoque {
  codigo: number
  estoqueCodigo: number
  descricao: string
  usuarioCodigoAlteracao: number
  dataHoraAtualizacao: string
  estoquePrincipal: boolean
  empresaCodigo: number
  vendePdv: boolean
  planoContaContabilCodigo: number
  ativo: boolean
  centroCustoCodigo: number
  estoqueCodigoExterno: string
}

/** Linha do /PRODUTO_ESTOQUE_EXTRATO — traz dados de CADASTRO (estoque mínimo/
 * máximo, preço de venda/custo) por produto, além do saldo atual. Arrays de
 * histórico/última entrada omitidos quando exibeHistoricoCompra=false. */
export interface ProdutoEstoqueExtrato {
  produtoCodigo: number
  empresaCodigo: number
  saldoAtual: number
  estoqueMinimo: number
  estoqueMaximo: number
  precoVenda: number
  precoCusto: number
}

export interface EstoquePeriodo {
  codigo: number
  codigoProduto: number
  codigoUnidadeNegocio: number
  quatidadeEstoque: number
  dataMovimento: string
}

export interface ContagemItem {
  produtoCodigo: number
  quantidadeAnterior: number
  quantidadeContagem: number
}

export interface ContagemNota {
  notaCodigo: number
  tipoMovimento: string
  movimentouSemNota: boolean
  contagemItens: ContagemItem[]
}

export interface ContagemEstoque {
  codigo: number
  contagemReferencia: number
  contagemCodigo: number
  unidadeNegocio: number
  dataHoraAlteracao: string
  descContagem: string
  usuarioCodigo: number
  emContagemColetor: boolean
  estoqueCodigo: number
  dataHoraCriacao: string
  dataHoraEstoqueContagem: string
  tipoContagem: string
  contagemRetroativa: boolean
  obsContagem: string
  contagemNotas: ContagemNota[]
}
