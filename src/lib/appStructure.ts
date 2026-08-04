import type { PlanoId } from '@/lib/planos'

/**
 * Estrutura ÚNICA do app (módulos → abas) com o tier de plano de cada peça.
 *
 * Fonte da verdade pra:
 *  - a tela de **Personalização** (Configurações) — mostrar/ocultar/reordenar
 *  - o **preset de plano** ("Aplicar plano") — que peças um plano inclui
 *  - o cruzamento com a **permissão** (`profiles.modulos_permitidos`, via `permId`)
 *
 * IMPORTANTE: `path` é a chave estável no store de personalização e os `tab.id`
 * batem 1:1 com os `?tab=` das páginas (e com os ids das stores de moduleLayout).
 * Não renomear sem migrar o store.
 *
 * Só entram aqui as abas que o app REALMENTE esconde/reordena (as que passam por
 * moduleLayout ou por um filtro no TopBarTabs). Módulos de aba única (Ao Vivo,
 * Inteligência, Qualidade, Compliance, Pessoas) ficam só no nível de módulo.
 */

export interface AppTab {
  /** Casa com o `?tab=` da página (default tab = id da 1ª aba). */
  id: string
  label: string
  /** Menor plano que já inclui esta aba. */
  plano: PlanoId
  /** Oculta por padrão (ex.: Fechamento/Cartões do Financeiro — legado). */
  defaultHidden?: boolean
}

/** Grupos do menu lateral (batem com navConfig). A reordenação da
 * personalização acontece DENTRO do grupo — o Sidebar mantém as seções. */
export type NavGroupId = 'geral' | 'analise' | 'posto' | 'gestao'

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'analise', label: 'Análise' },
  { id: 'posto', label: 'Posto' },
  { id: 'gestao', label: 'Gestão' },
]

export interface AppModule {
  /** Rota — chave estável no store de personalização. */
  path: string
  label: string
  /** Grupo no menu lateral. */
  group: NavGroupId
  /** Menor plano que já inclui este módulo. */
  plano: PlanoId
  /** Id no catálogo de permissão (src/lib/modulos.ts). Ausente = fora do gate
   * de permissão (Ao Vivo é intencional; Compliance é gap conhecido). */
  permId?: string
  tabs: AppTab[]
}

export const APP_STRUCTURE: AppModule[] = [
  {
    path: '/dashboard',
    label: 'Central da Rede',
    group: 'geral',
    plano: 'basic',
    permId: 'dashboard',
    tabs: [
      { id: 'setor', label: 'Visão Geral', plano: 'basic' },
      { id: 'combustivel', label: 'Combustível', plano: 'basic' },
      { id: 'pista', label: 'Automotivo', plano: 'basic' },
      { id: 'conveniencia', label: 'Conveniência', plano: 'basic' },
      { id: 'precos', label: 'Gestão de Preços', plano: 'premium' },
    ],
  },
  {
    path: '/ao-vivo',
    label: 'Ao Vivo',
    group: 'geral',
    plano: 'basic',
    tabs: [],
  },
  {
    path: '/comercial',
    label: 'Comercial',
    group: 'analise',
    plano: 'premium',
    permId: 'comercial',
    tabs: [
      { id: 'oportunidades', label: 'Oportunidades', plano: 'premium' },
      { id: 'margem', label: 'Margem por posto', plano: 'premium' },
      { id: 'concorrencia', label: 'Concorrência', plano: 'premium' },
      { id: 'radar', label: 'Radar de Preços', plano: 'pro' },
    ],
  },
  {
    path: '/inteligencia',
    label: 'Inteligência',
    group: 'analise',
    plano: 'pro',
    permId: 'inteligencia',
    tabs: [],
  },
  {
    path: '/operacao',
    label: 'Operação',
    group: 'posto',
    plano: 'premium',
    permId: 'bombas',
    tabs: [
      { id: 'geral', label: 'Visão Geral', plano: 'premium' },
      { id: 'bombas', label: 'Bombas', plano: 'premium' },
      { id: 'reabastecimento', label: 'Reabastecimento', plano: 'premium' },
    ],
  },
  {
    path: '/produtividade',
    label: 'Produtividade',
    group: 'posto',
    plano: 'premium',
    permId: 'produtividade',
    tabs: [
      { id: 'dash', label: 'Visão Geral', plano: 'premium' },
      { id: 'funcionarios', label: 'Funcionários', plano: 'premium' },
      { id: 'rede', label: 'Resumo da rede', plano: 'premium' },
    ],
  },
  {
    path: '/estoques',
    label: 'Estoques',
    group: 'gestao',
    plano: 'pro',
    permId: 'estoques',
    tabs: [
      { id: 'visao', label: 'Visão Geral', plano: 'pro' },
      { id: 'geral', label: 'Estoque geral', plano: 'pro' },
      { id: 'giro', label: 'Giro', plano: 'pro' },
      { id: 'mediaVendas', label: 'Média de venda (6m)', plano: 'pro' },
      { id: 'necessidade', label: 'Necessidade', plano: 'pro' },
    ],
  },
  {
    path: '/financeiro',
    label: 'Financeiro',
    group: 'gestao',
    plano: 'pro',
    permId: 'financeiro',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', plano: 'pro' },
      { id: 'receber', label: 'Receber', plano: 'pro' },
      { id: 'pagar', label: 'Pagar', plano: 'pro' },
      { id: 'fechamento', label: 'Fechamento', plano: 'pro', defaultHidden: true },
      { id: 'cartoes', label: 'Cartões', plano: 'pro', defaultHidden: true },
    ],
  },
  {
    path: '/qualidade-dados',
    label: 'Qualidade de Dados',
    group: 'gestao',
    plano: 'pro',
    permId: 'qualidade-dados',
    tabs: [],
  },
  {
    path: '/compliance',
    label: 'Compliance ANP',
    group: 'gestao',
    plano: 'pro',
    // Sem permId: hoje fica FORA do gate de permissão (gap conhecido —
    // ver project_nav_audit_pendencias). Personalização já cobre cosmeticamente.
    tabs: [],
  },
  {
    path: '/pessoas',
    label: 'Pessoas',
    group: 'gestao',
    plano: 'pro',
    permId: 'pessoas',
    tabs: [],
  },
]

const MODULE_BY_PATH = new Map(APP_STRUCTURE.map((m) => [m.path, m]))

export const moduleByPath = (path: string): AppModule | undefined => MODULE_BY_PATH.get(path)

/** Chave composta de uma aba no store de personalização. */
export const tabKey = (path: string, tabId: string): string => `${path}::${tabId}`

/** Ordem dos planos pra comparar tiers (basic < premium < pro). */
export const PLANO_RANK: Record<PlanoId, number> = { basic: 0, premium: 1, pro: 2 }

/** true se `alvo` está incluído no `plano` (tier do alvo <= tier do plano). */
export const incluidoNoPlano = (alvo: PlanoId, plano: PlanoId): boolean =>
  PLANO_RANK[alvo] <= PLANO_RANK[plano]
