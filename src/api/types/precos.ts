// Tipos da "Tabela de Preço de Prazos" (BARATAO, TABACARIA, …) — GET only.
// Fonte: GET /INTEGRACAO/TABELA_PRECO_PRAZO. Substitui a ingestão manual via
// XLSX (o endpoint não existia em GET quando a tela foi criada).

/** Linha de "Preço Especial" de uma tabela de prazo. */
export interface PrecoEspecialItem {
  precoPrazoItemCodigo: number
  /** Posto (unidade) a que a linha se aplica — já vem resolvido pelo ERP. */
  empresaCodigo: number | null
  clienteCodigo: number | null
  grupoClienteCodigo: number | null
  /** Casa 1:1 com o produtoCodigo do /PRODUTO. Null = regra em nível de grupo. */
  produtoCodigo: number | null
  grupoCodigo: number | null
  subGrupoCodigo: number | null
  /** 0 = à vista, 1 = a prazo (condição da transação). */
  tipoTransacao: number
  /** Base do preço de venda (0 = A, 1 = B, …). */
  bcPrecoVenda: number
  /** 0 = valor específico (R$); ≠ 0 = desconto/percentual. */
  tipo: number
  /** Preço em R$ (tipo 0) ou percentual (tipo ≠ 0). */
  valor: number
  usaIntervalo: string
  tipoIntervalo: number
  de: number
  ate: number
}

/** Cabeçalho da tabela de prazo (uma "Ref" da tela do WebPosto). */
export interface TabelaPrecoPrazo {
  tabelaPrecoPrazoCodigo: number
  referencia: string
  descricao: string
  /** Dígitos dos dias de vigência, ex.: '1234567' = todos os dias (1 = domingo). */
  diasSemana: string
  validadeInicial: string
  validadeFinal: string
  horaDia: boolean
  prazoCodigo: number[]
  precoEspecialItem: PrecoEspecialItem[]
  codigo: number
}
