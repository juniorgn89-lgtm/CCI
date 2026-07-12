// Fundo levíssimo, UMA cor por grupo de coluna (aplicado via <colgroup> nas
// tabelas setorizadas). Vai ATRÁS do conteúdo/barras e some sob linhas de fundo
// opaco (Total/selecionada). Cor por tema, consistente em toda a Central:
//   volume=azul · dinheiro=âmbar · comparativo=violeta · eficiência=verde.
export const GROUP_TINT = {
  operacao: 'bg-sky-50/60 dark:bg-sky-400/[0.05]',
  financeiro: 'bg-amber-50/50 dark:bg-amber-400/[0.05]',
  comparativo: 'bg-violet-50/50 dark:bg-violet-400/[0.06]',
  eficiencia: 'bg-emerald-50/50 dark:bg-emerald-400/[0.05]',
} as const
