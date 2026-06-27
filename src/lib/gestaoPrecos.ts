/**
 * Constantes e rótulos de honestidade da tela Gestão de Preços (Central da Rede).
 *
 * Nascem aqui, na FUNDAÇÃO (sub-fase 1.0), de propósito: o rótulo de BASE e a
 * nota da mistura físico×fiscal têm que acompanhar o dado desde o começo — não
 * podem ser bolted-on depois, senão alguém lê o "potencial" como se fosse tudo
 * fiscal.
 *
 * Contrato:
 *  - Desvio = `preco_cadastro − valor_unitario` → base FÍSICA (/ABASTECIMENTO).
 *  - LB realizado vem do cache FISCAL (useRedeSetores).
 *  - "Potencial = realizado + cedido" cruza as duas bases → leitura de
 *    tendência, não conciliação centavo-a-centavo. Exibir BASE_MIX_NOTE junto.
 */

/** Selo de base do desvio — exibir perto de todo número de "cedido". */
export const BASE_DESVIO_LABEL = 'desvio físico · base abastecimento'

/** Nota da mistura de bases — obrigatória no painel "Impacto no LB". */
export const BASE_MIX_NOTE =
  'O LB realizado é fiscal (cupom); o valor cedido é físico (abastecimento). O "potencial = realizado + cedido" cruza as duas bases — leitura de tendência, não conciliação centavo-a-centavo.'

/** "Recuperação estimada" é sempre teto, nunca promessa. */
export const RECUPERACAO_LABEL = 'estimativa · teto'

/**
 * Limiares de severidade do % de LB cedido (sobre o potencial do posto).
 * Mantidos do protótipo; afináveis quando virem os desvios reais.
 */
export const SEVERIDADE_CEDIDO = {
  /** ≥ 12% do LB potencial cedido → vermelho. */
  alto: 12,
  /** ≥ 6% → âmbar; abaixo → verde. */
  medio: 6,
} as const

/**
 * Preço de tabela só conta quando > 0 — exclui aferição / abastecimento sem
 * cadastro de preço (preco_cadastro NULL vira 0 ao ler do cache).
 */
export const PRECO_CADASTRO_MIN = 0

/** Severidade (cor) a partir do % de LB cedido sobre o potencial. */
export type SeveridadeCedido = 'alto' | 'medio' | 'baixo'
export const severidadeCedido = (pctCedido: number): SeveridadeCedido =>
  pctCedido >= SEVERIDADE_CEDIDO.alto ? 'alto' : pctCedido >= SEVERIDADE_CEDIDO.medio ? 'medio' : 'baixo'
