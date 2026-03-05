export interface ProdutoCodigoBarra {
  codigoBarra: string
}

export interface Produto {
  codigo: number
  produtoCodigo: number
  nome: string
  referenciaCodigo: string
  grupoCodigo: number
  combustivel: boolean
  produtoLmcCodigo: number
  tipoCombustivel: string
  unidadeCompra: string
  unidadeVenda: string
  subGrupo1Codigo: number
  subGrupo2Codigo: number
  subGrupo3Codigo: number
  tipoProduto: string
  produtoCodigoExterno: string
  tributacaoAdRem: number
  descricaoFabricante: string
  registraInventario: string
  ncm: string
  cest: string
  misturaBioCombustivel: number
  codigoAnp: string
  percUfOrigemScanc: number
  produtoCodigoBarra: ProdutoCodigoBarra[]
  ativo: boolean
}

export interface Grupo {
  codigo: number
  grupoCodigo: number
  nome: string
  ultimoUsuarioAlteracao: string
  grupoCodigoExterno: string
  codigoTributoIcms: number
  codigoTributoPisCofins: number
  descricaoTributoIcms: string
  descricaoTributoPisCofins: string
  tipoGrupo: string
}

export interface GrupoMeta {
  codigo: number
  grupoMetaCodigo: number
  descricao: string
  empresaCodigo: number
}

export interface ProdutoMeta {
  codigo: number
  grupoMetaCodigo: number
  produtoCodigo: number
}
