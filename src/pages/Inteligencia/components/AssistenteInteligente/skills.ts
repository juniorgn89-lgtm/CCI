import {
  TrendingDown,
  Trophy,
  Truck,
  CalendarClock,
  HandCoins,
  Wallet,
  Scale,
  Network,
  Users,
  ShoppingCart,
  PackageX,
  type LucideIcon,
} from 'lucide-react'

/**
 * "Análises prontas" (skills) do Cadu — cartões de um clique que disparam uma
 * pergunta pré-escrita ao chat. NÃO é uma engine nova: cada skill é só um prompt
 * que o Cadu responde com as tools que já existem (ver ai/tools.ts). O objetivo é
 * matar a "página em branco" — o dono/vendedor abre o Cadu e já tem o que perguntar.
 *
 * Só entram análises que rodam com o dado de hoje e são confiáveis. Margem de
 * conveniência (depende de custo cadastrado) e afins ficaram de fora de propósito.
 */

export type SkillTone = 'amber' | 'blue' | 'teal' | 'purple'

export type SkillGrupo =
  | 'Combustível & margem'
  | 'Financeiro'
  | 'Vendas & equipe'
  | 'Estoque'

export interface CaduSkill {
  id: string
  grupo: SkillGrupo
  label: string
  /** Uma linha — aparece embaixo do título no cartão. */
  desc: string
  /** A pergunta real enviada ao Cadu ao clicar. */
  prompt: string
  Icon: LucideIcon
  tone: SkillTone
  /** Skills de maior impacto (combustível/financeiro) ganham selo de destaque. */
  destaque?: boolean
}

/** Ordem das seções na galeria. */
export const SKILL_GRUPOS: SkillGrupo[] = [
  'Combustível & margem',
  'Financeiro',
  'Vendas & equipe',
  'Estoque',
]

/**
 * Estilo por tom (light + dark). `icon` = chip com gradiente sólido; `card` =
 * início do gradiente de fundo (bem sutil); `hover` = cor da borda no hover.
 */
export const SKILL_TONE_STYLE: Record<
  SkillTone,
  { icon: string; card: string; hover: string }
> = {
  amber: {
    icon: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/25',
    card: 'from-amber-50/70 dark:from-amber-900/10',
    hover: 'hover:border-amber-300 dark:hover:border-amber-600/50',
  },
  blue: {
    icon: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/25',
    card: 'from-blue-50/70 dark:from-blue-900/10',
    hover: 'hover:border-blue-300 dark:hover:border-blue-600/50',
  },
  teal: {
    icon: 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md shadow-teal-500/25',
    card: 'from-teal-50/70 dark:from-teal-900/10',
    hover: 'hover:border-teal-300 dark:hover:border-teal-600/50',
  },
  purple: {
    icon: 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-md shadow-purple-500/25',
    card: 'from-purple-50/70 dark:from-purple-900/10',
    hover: 'hover:border-purple-300 dark:hover:border-purple-600/50',
  },
}

export const CADU_SKILLS: CaduSkill[] = [
  /* ─── Combustível & margem ─── */
  {
    id: 'margem-perdida',
    grupo: 'Combustível & margem',
    label: 'Onde estou perdendo margem?',
    desc: 'Compara o mesmo combustível posto a posto e estima o ganho em R$.',
    prompt:
      'Compare o preço e a margem do mesmo combustível entre todos os meus postos neste mês. Aponte onde estou perdendo margem: quais postos e produtos estão com o lucro por litro abaixo da média da rede e, para cada um, estime em reais quanto eu ganharia por mês alinhando à média da rede. Seja direto e ordene pelas maiores oportunidades.',
    Icon: TrendingDown,
    tone: 'amber',
    destaque: true,
  },
  {
    id: 'ranking-lucro',
    grupo: 'Combustível & margem',
    label: 'Ranking de lucro por posto',
    desc: 'Lucro bruto e margem de combustível de cada posto, do melhor ao pior.',
    prompt:
      'Monte um ranking dos meus postos pelo lucro bruto e pela margem de combustível neste mês. Diga qual posto está melhor e qual está pior e o que mais chama atenção na comparação.',
    Icon: Trophy,
    tone: 'amber',
  },
  {
    id: 'custo-reposicao',
    grupo: 'Combustível & margem',
    label: 'Custo da última compra',
    desc: 'A última entrada de combustível e o custo por litro de cada posto.',
    prompt:
      'Qual foi a última compra (entrada) de combustível de cada posto, com a data e o custo por litro? Aponte em quais postos o custo de reposição está mais alto.',
    Icon: Truck,
    tone: 'amber',
  },

  /* ─── Financeiro ─── */
  {
    id: 'contas-semana',
    grupo: 'Financeiro',
    label: 'O que vou pagar essa semana?',
    desc: 'Contas a pagar dos próximos 7 dias e o que já está vencido.',
    prompt:
      'Liste as contas a pagar com vencimento nos próximos 7 dias e também o que já está vencido. Agrupe por fornecedor e por posto e me diga o total a pagar e o total vencido.',
    Icon: CalendarClock,
    tone: 'blue',
    destaque: true,
  },
  {
    id: 'a-receber',
    grupo: 'Financeiro',
    label: 'Quanto tenho a receber?',
    desc: 'Total a receber, o que está vencido e os maiores clientes.',
    prompt:
      'Quanto eu tenho a receber e quanto disso já está vencido? Mostre os maiores clientes e valores, e o total por posto.',
    Icon: HandCoins,
    tone: 'blue',
  },
  {
    id: 'caixa-mes',
    grupo: 'Financeiro',
    label: 'Como está meu caixa?',
    desc: 'Entradas x saídas do mês, saldo e o que mais pesou.',
    prompt:
      'Como está meu fluxo de caixa neste mês? Compare entradas e saídas, mostre o saldo do período e o que mais pesou nas saídas.',
    Icon: Wallet,
    tone: 'blue',
  },
  {
    id: 'caixa-cobre-contas',
    grupo: 'Financeiro',
    label: 'Meu caixa cobre as contas?',
    desc: 'Cruza o que entrou de caixa com as contas a pagar em aberto.',
    prompt:
      'Compare o que eu tenho a pagar (contas a pagar em aberto) com o que entrou de caixa neste mês. O caixa cobre as contas? Sinalize se há risco de aperto e em quais postos.',
    Icon: Scale,
    tone: 'blue',
  },

  /* ─── Vendas & equipe ─── */
  {
    id: 'resumo-rede',
    grupo: 'Vendas & equipe',
    label: 'Resumo da rede no mês',
    desc: 'Faturamento, ticket médio e ranking dos postos.',
    prompt:
      'Me dê um resumo da rede neste mês: faturamento total, ticket médio e o ranking dos postos por faturamento. Aponte os destaques e as quedas.',
    Icon: Network,
    tone: 'teal',
  },
  {
    id: 'top-frentistas',
    grupo: 'Vendas & equipe',
    label: 'Top frentistas',
    desc: 'Quem mais vendeu em litros e faturamento neste mês.',
    prompt:
      'Quais são os frentistas que mais venderam neste mês, em litros e em faturamento? Mostre o ranking e o ticket médio de cada um.',
    Icon: Users,
    tone: 'teal',
  },
  {
    id: 'campeoes-conveniencia',
    grupo: 'Vendas & equipe',
    label: 'Campeões da conveniência',
    desc: 'Os produtos que mais vendem e faturam na loja.',
    prompt:
      'Quais são os produtos que mais vendem e mais faturam na conveniência neste mês? Liste o top 10.',
    Icon: ShoppingCart,
    tone: 'teal',
  },

  /* ─── Estoque ─── */
  {
    id: 'estoque-parado',
    grupo: 'Estoque',
    label: 'Dinheiro parado no estoque',
    desc: 'Produtos sem giro e quanto de capital estão prendendo.',
    prompt:
      'Quais produtos estão com estoque parado (sem giro) e quanto de dinheiro isso representa? Liste os principais e sugira o que priorizar.',
    Icon: PackageX,
    tone: 'purple',
  },
]
