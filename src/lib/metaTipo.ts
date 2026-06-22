/** Tipo de meta inferido da descrição livre cadastrada no Quality (/FUNCIONARIO_META). */
export type MetaTipo = 'litros' | 'faturamento' | 'abastecimentos' | null

/**
 * Classifica a descrição livre da meta do funcionário em um tipo conhecido.
 * O Quality guarda a meta como texto livre (`descricao`) + `valor`; mapeamos por
 * palavra-chave. "litro"/"aditiv" → litros · "fatur/venda/receita" → faturamento
 * · "abastec/atend" → abastecimentos.
 */
export const detectMetaTipo = (desc: string): MetaTipo => {
  const d = (desc ?? '').toLowerCase()
  if (d.includes('litro') || d.includes('aditiv')) return 'litros'
  if (d.includes('fatur') || d.includes('venda') || d.includes('receita')) return 'faturamento'
  if (d.includes('abastec') || d.includes('atend')) return 'abastecimentos'
  return null
}
