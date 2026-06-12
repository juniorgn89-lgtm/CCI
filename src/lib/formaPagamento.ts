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
