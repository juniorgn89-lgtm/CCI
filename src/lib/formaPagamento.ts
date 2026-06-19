/**
 * Normaliza o rótulo de exibição de uma forma de pagamento.
 * As formas "MENSAL + N" (crediário com prazo em dias) são vendas a prazo —
 * exibimos todas como "A Prazo" pra ficar claro pro gestor.
 */
export const labelFormaPagamento = (nome: string): string => {
  const n = (nome || '').trim()
  if (/^mensal\b/i.test(n)) return 'A Prazo'
  return n
}

/** Tipo canônico unificado de "Cartão" — o TEF (transferência eletrônica de
 *  fundos, via maquininha) é cartão e deve ser somado junto. */
export const CARTAO_TIPO = 'CARTAO.'
export const isCartaoForma = (tipo: string, nome = ''): boolean => {
  const s = `${tipo} ${nome}`.toUpperCase()
  return s.includes('CARTAO') || s.includes('CARTÃO') || s.includes('TEF')
}
