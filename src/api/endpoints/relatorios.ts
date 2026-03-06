import { client } from '@/api/client'
import type { PaginatedResponse } from '@/api/types/common'
import type { RelatorioPersonalizadoItem } from '@/api/types/relatorio'

interface FetchProdutividadeFuncionarioParams {
  tipoRelatorio?: 'SINTETICO' | 'ANALITICO'
  tipoData?: 'FISCAL' | 'MOVIMENTO' | 'CAIXA'
  funcionario?: number
  produto?: number
  caixa?: string
  dataInicial?: string
  dataFinal?: string
  ordenacao?: 'NOME_FUNCIONARIO' | 'QUANTIDADE' | 'PRODUTO' | 'VALOR_PRODUTO' | 'NUMERO_ABASTECIMENTO' | 'VALOR_ABASTECIMENTO' | 'TOTAL_MARGEM' | 'BRUTA' | 'REFERENCIA_FUNCIONARIO' | 'CUPONS'
  referenciaFuncionario?: 'FUNCIONARIO' | 'RETIRO' | 'CUPOM' | 'FUNCIONARIO_ABASTECIMENTO' | 'FUNCIONARIO_IDENTIFICADOR' | 'FINAL_VENDA'
  grupoProduto?: number[]
  subGrupoProduto?: number[]
  pdv?: number[]
  funcoes?: string
  tipoFiltro?: 'SEM_FILTRO' | 'NUMERO_ABASTECIMENTO' | 'QUANTIDADE' | 'PRECO_MEDIO' | 'TOTAL' | 'MARGEM_BRUTA'
  intervaloFiltro?: 'SEM_INTERVALO' | 'QUANTIDADE_IGUAL' | 'QUANTIDADE_NAO_E_IGUAL' | 'QUANTIDADE_INFERIOR' | 'QUANTIDADE_MENOR_OU_IGUAL' | 'QUANTIDADE_MAIOR' | 'QUANTIDADE_MAIOR_OU_IGUAL' | 'QUANTIDADE_ENTRE'
  valorInicialFiltro?: number
  valorFinalFiltro?: number
  calculoTicketMedio?: 'QUANTIDADE_ITENS' | 'QUANTIDADE_VENDAS'
  agrupamento?: 'FUNCIONARIO' | 'DIA' | 'FUNCAO'
  filial?: number
  comissao?: 'AMBOS' | 'PRODUTO_COM_COMISSAO' | 'PRODUTO_SEM_COMISSAO'
  detalhesTotalizadorPorGrupo?: boolean
  cliente?: string
  grupoCliente?: string
}

interface FetchMapaDesempenhoParams {
  dataInicial: string
  dataFinal: string
  funcionario?: number[]
  grupoProduto?: number[]
  subGrupoProduto?: number[]
  produto?: number
  usaDataPrestacao?: boolean
  baseComissao?: 'VENDA' | 'MARGEM_LUCRO'
  referenciaFuncionario?: 'FUNCIONARIO' | 'RETIRO' | 'CUPOM' | 'FUNCIONARIO_ABASTECIMENTO' | 'FUNCIONARIO_IDENTIFICADOR' | 'FINAL_VENDA'
  tipoRelatorio?: 'SINTETICO' | 'ANALITICO'
  ordenacao?: 'FUNCIONARIO' | 'PREMIACAO' | 'QUANTIDADE_VENDIDA' | 'VALOR_VENDIDO'
  pdv?: number[]
  prestacaoBaseadaNoHistorico?: boolean
  apurarComissionado?: boolean
  horaInicial?: string
  horaFinal?: string
  cliente?: number
  apuracao?: 'TSR' | 'VENDA' | 'ACUMULADO'
  filial?: number[]
}

interface FetchVendaPeriodoParams {
  empresaCodigo: number
  ordenacaoPor: 'REFERENCIA' | 'PRODUTO' | 'PARTICIPACAO' | 'QUANTIDADE_VENDIDA'
  dataInicial: string
  dataFinal: string
  tipoData: 'FISCAL' | 'MOVIMENTACAO'
  agrupamentoPor?: 'SEM_AGRUPAMENTO' | 'TURNO' | 'DIA' | 'PRODUTO' | 'CLIENTE' | 'MES' | 'ESTOQUE' | 'SETOR' | 'PRODUTO_KIT' | 'GRUPO_PRODUTO' | 'FUNCIONARIO' | 'GRUPO_CLIENTE'
  placa?: string
  formaPagamento?: number[]
  formatoExportarDados?: string
  horaInicial?: string
  horaFinal?: string
  grupoProduto?: number[]
  turno?: number[]
  funcionario?: number[]
  produto?: number
  cliente?: string
  pdvCaixa?: number
  tipoProduto?: 'COMBUSTIVEL' | 'COMPOSTOS' | 'INSUMO' | 'KIT' | 'PRODUTO' | 'SERVICO' | 'LAVO_CONSUMO' | 'AFNS' | 'REEMBALAGEM'
  filial?: number
  estoque?: string
  formaPagamentoDetalhe?: string
  tipoVenda?: 'AMBOS' | 'ITEM_ACRESCIMO' | 'ITEM_DESCONTO'
  apresentarPrecoVendaEstilo?: boolean
  grupoCliente?: string
  centroCusto?: string
  consolidarFiliais?: boolean
  subGrupoProdutoNivel1?: string
  subGrupoProdutoNivel2?: number[]
  subGrupoProdutoNivel3?: string
  agruparModoExibicao?: 'GRUPO' | 'SUB_GRUPO' | 'AGRUPADO' | 'VDDSEQ' | 'SUB_GRUPO_PARTICIPACAO'
  exibirModoExibicao?: 'AMBOS' | 'PISTA' | 'LOJA'
  pdvQueGeraVenda?: string
  centroCustoConvite?: string
}

interface FetchRelatorioPersonalizadoParams {
  cliente?: string
  dataInicial?: string
  dataFinal?: string
  caixa?: string
  funcionario?: string
  grupoProduto?: number[]
  administradora?: string
  situacaoReceber?: 'AMBOS' | 'ABERTO' | 'RECEBIDO'
  filial?: number[]
  produto?: number
  distribuidor?: string
  modeloDocumentoFiscal?: 'NFCE' | 'SAT' | 'NFE' | 'ECF' | 'MANUAL' | 'MFE'
  planoConta?: string
  intermediador?: string
  datePrestacao?: string
  situacaoTr?: string
  subGrupoProduto?: number[]
  estoque?: number[]
  centroCusto?: number[]
  individual?: boolean
  tipoPromocao?: 'PONTUALIDADE' | 'MENSAL' | 'PREMIADO'
  situacaoCaixa?: 'CONSOLIDADO' | 'FECHADO'
  filialOrigem?: number[]
  tipoRecepcao?: string
  saldoInicial?: string
  placa?: string
  espaco?: string
  titulo?: string
  remessa?: string
  conta?: string
  grupoCliente?: string
  motorista?: string
  veiculo?: string
  plano?: string
  centroCustoCliente?: string
  cfop?: string
  tipoFiltro?: 'QUANTIDADE' | 'VALOR'
  tipoOperacaoComparador?: 'IGUAL' | 'DIFERENTE' | 'MENOR' | 'MENOR_IGUAL' | 'MAIOR' | 'MAIOR_IGUAL' | 'ENTRE'
  valor1Comparador?: number
  valor2Comparador?: number
}

interface FetchRelatoriosDisponiveisParams {
  ultimoCodigo?: number
  limite?: number
}

export const fetchProdutividadeFuncionario = (params?: FetchProdutividadeFuncionarioParams) =>
  client.get<Blob>('/RELATORIO/PRODUTIVIDADE_FUNCIONARIO', { params, responseType: 'blob' }).then((res) => res.data)

export const fetchMapaDesempenho = (params: FetchMapaDesempenhoParams) =>
  client.get<Blob>('/RELATORIO/MAPA_DESEMPENHO', { params, responseType: 'blob' }).then((res) => res.data)

export const fetchVendaPeriodo = (params: FetchVendaPeriodoParams) =>
  client.get<Blob>('/RELATORIO/VENDA_PERIODO', { params, responseType: 'blob' }).then((res) => res.data)

export const fetchRelatorioPersonalizado = (codigo: number, params?: FetchRelatorioPersonalizadoParams) =>
  client.get<Blob>(`/RELATORIO/RELATORIO_PERSONALIZADO/${codigo}`, { params, responseType: 'blob' }).then((res) => res.data)

export const fetchRelatoriosDisponiveis = (params?: FetchRelatoriosDisponiveisParams) =>
  client.get<PaginatedResponse<RelatorioPersonalizadoItem>>('/RELATORIO_PERSONALIZADO', { params }).then((res) => res.data)
