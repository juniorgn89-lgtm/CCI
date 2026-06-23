/**
 * Diferença exibida de um caixa = apresentado − apurado CONFERIDO (mesma fonte
 * /CAIXA_APRESENTADO; fecha por subtração igual à Conferência por PDV). Usar o
 * apuradoConferido (não o apurado de VENDAS, que inclui a prazo) evita inflar a
 * diferença em postos de pista. Sem dado de conferência, cai na diferença
 * oficial do /CAIXA. Extraído do Fechamento · Visão Geral pra reuso (aba Diferenças).
 */
export const difCaixa = (c: {
  apresentadoTotal: number | null
  apuradoConferido: number | null
  diferenca: number
}): number =>
  c.apresentadoTotal != null && c.apuradoConferido != null
    ? c.apresentadoTotal - c.apuradoConferido
    : c.diferenca

/** Forma é de cartão? (classifica o nome livre da forma de pagamento). */
export const isCartaoForma = (nome: string): boolean =>
  (nome ?? '').toUpperCase().includes('CART')
