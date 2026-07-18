// Fundo levíssimo por grupo de coluna (aplicado via <colgroup> nas tabelas
// setorizadas). Vai ATRÁS do conteúdo/barras e some sob linhas de fundo opaco
// (Total/selecionada).
//
// CLARO: uma cor pastel por grupo (volume=azul · dinheiro=âmbar · comparativo=
// violeta · eficiência=verde) — filme colorido combina com fundo branco.
// DARK: filme colorido a ~5% sobre o preto vira cinza-quente sujo, então aqui é
// só um degrau NEUTRO de luz, alternado, pra separar os grupos sem cast de cor
// (os divisores verticais entre grupos completam a leitura).
export const GROUP_TINT = {
  operacao: 'bg-sky-50/60 dark:bg-transparent',
  financeiro: 'bg-amber-50/50 dark:bg-white/[0.03]',
  comparativo: 'bg-violet-50/50 dark:bg-transparent',
  eficiencia: 'bg-emerald-50/50 dark:bg-white/[0.03]',
} as const
