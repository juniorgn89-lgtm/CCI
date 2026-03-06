export interface MapaDesempenho {
  empresaCodigo: number
  empresaNome: string
  faturamentoTotal: number
  faturamentoCombustivel: number
  faturamentoProdutos: number
  faturamentoConveniencia: number
  margemTotal: number
  margemCombustivel: number
  margemProdutos: number
  margemConveniencia: number
  litrosVendidos: number
  ticketMedio: number
  quantidadeVendas: number
}

export interface VendaPeriodo {
  empresaCodigo: number
  data: string
  faturamentoTotal: number
  faturamentoCombustivel: number
  faturamentoProdutos: number
  faturamentoConveniencia: number
  quantidadeVendas: number
  litrosVendidos: number
  ticketMedio: number
}

export interface RelatorioPersonalizadoItem {
  codigo: number
  descricao: string
  tipo: string
  ativo: boolean
}

export interface RelatorioPersonalizadoResultado {
  colunas: string[]
  linhas: Record<string, unknown>[]
}
