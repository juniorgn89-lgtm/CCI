/**
 * Catálogo de PLANOS comerciais do Visor360 (Basic / Premium / Pro).
 *
 * Fonte da verdade ÚNICA — alimenta a vitrine da landing (`/`) E o card
 * "Meu plano" em Configurações. Cada plano é um preset de módulos/abas que já
 * existem no app (ver src/lib/modulos.ts + as abas do Dashboard/Comercial).
 *
 * NESTA FASE é só informativo: o plano da rede (`redes.plano`) é exibido, mas
 * NÃO trava módulo — a trava por plano (esconder Gestão de Preço no Basic,
 * Radar no Premium etc.) fica pra uma fase seguinte. Hoje o acesso real segue
 * governado por `profiles.modulos_permitidos` (liberado pelo rep/admin).
 *
 * Preço fica "sob consulta" de propósito (sem valor inventado) — o CTA manda
 * pro comercial, igual ao resto da landing.
 */

export type PlanoId = 'basic' | 'premium' | 'pro'

export interface PlanoDef {
  id: PlanoId
  /** Nome comercial exibido ("Basic"). */
  nome: string
  /** Pitch curto de uma linha. */
  tagline: string
  /** Plano recomendado — destacado na vitrine. */
  destaque?: boolean
  /**
   * Cabeçalho da lista quando o plano herda o anterior
   * ("Tudo do Basic, mais:"). Ausente no Basic (não herda nada).
   */
  baseLabel?: string
  /** Recursos INCREMENTAIS deste plano (o que ele acrescenta ao anterior). */
  recursos: string[]
}

export const PLANOS: PlanoDef[] = [
  {
    id: 'basic',
    nome: 'Basic',
    tagline: 'O essencial pra acompanhar a rede todo dia.',
    recursos: [
      'Visão Geral da rede — faturamento, lucro e margem com projeção do período',
      'Combustível — volume e margem por produto',
      'Automotivos — troca de óleo e serviços da pista',
      'Conveniência — loja, ticket médio e giro',
      'Ao Vivo — a rede em tempo real, posto a posto',
    ],
  },
  {
    id: 'premium',
    nome: 'Premium',
    tagline: 'As alavancas de lucro e a operação, além do essencial.',
    destaque: true,
    baseLabel: 'Tudo do Basic, mais:',
    recursos: [
      'Gestão de Preço — tabelas e o impacto real do desconto no lucro',
      'Comercial — oportunidades de lucro e margem por posto',
      'Operação — bombas, desgaste e reabastecimento',
      'Produtividade — desempenho da equipe por posto',
    ],
  },
  {
    id: 'pro',
    nome: 'Pro',
    tagline: 'A rede inteira: inteligência, financeiro e conformidade.',
    baseLabel: 'Tudo do Premium, mais:',
    recursos: [
      'Radar de Preços — guerra de preço, elasticidade e simulação',
      'Financeiro — títulos, cartões e conciliação',
      'Estoques — saldo, mínimo e cobertura',
      'Compliance ANP — margem regulatória',
      'Qualidade de Dados — auditoria e detecção de fraude',
      'Analista de IA — a Inteligência que explica o número',
    ],
  },
]

const PLANO_BY_ID = new Map<string, PlanoDef>(PLANOS.map((p) => [p.id, p]))

/** Plano pelo id; `undefined` quando o valor é nulo/desconhecido (rede sem plano definido). */
export const getPlano = (id: string | null | undefined): PlanoDef | undefined =>
  id ? PLANO_BY_ID.get(id) : undefined

/** Nome de exibição do plano ("Basic"); fallback neutro quando não definido. */
export const planoNome = (id: string | null | undefined): string =>
  getPlano(id)?.nome ?? 'Não definido'

/**
 * Recursos ACUMULADOS até o plano dado (Basic → Premium → Pro), agrupados por
 * plano de origem. Usado no card "Meu plano" pra mostrar tudo que a rede tem.
 */
export const recursosAcumulados = (id: PlanoId): { plano: PlanoDef; recursos: string[] }[] => {
  const idx = PLANOS.findIndex((p) => p.id === id)
  if (idx < 0) return []
  return PLANOS.slice(0, idx + 1).map((plano) => ({ plano, recursos: plano.recursos }))
}
