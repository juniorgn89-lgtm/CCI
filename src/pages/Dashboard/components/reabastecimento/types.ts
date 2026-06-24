import type { LucideIcon } from 'lucide-react'

/**
 * View-model NORMALIZADO da aba Reabastecimento — o coração da arquitetura.
 * Cada sub-aba (Combustível/Automotivo/Conveniência) mapeia seus dados PRA ESTE
 * shape; os componentes são burros e só renderizam o modelo. Cor/rótulo/unidade
 * são DADOS do modelo (tone/kind), não `if (setor)` espalhado nos componentes.
 */

export type ReposicaoSetor = 'combustivel' | 'automotivo' | 'conveniencia'

/** Tom visual de status — dirige cor de badge/barra/valor (ver tones.ts). */
export type Tone = 'critico' | 'alerta' | 'negativo' | 'ruptura' | 'vencendo' | 'curvaA' | 'neutral'

/** KPI hero (navy) — o "total a comprar / compra sugerida". */
export interface ReposicaoHero {
  label: string
  /** Sub em uppercase ("ATÉ O FIM DO MÊS"). */
  hint?: string
  /** Valor já formatado ("84.500" ou "R$ 38.400"). */
  value: string
  /** Unidade grande após o valor (ex.: "L"). Omitir p/ R$. */
  unit?: string
  Icon: LucideIcon
  /** Rodapé esquerdo ("14 tanques · 4 postos"). */
  footer?: string
  /** Selo âmbar à direita do rodapé ("~R$ 487 mil"). */
  footerBadge?: string
}

/** Card de status (os 3 ao lado do hero). */
export interface ReposicaoKpi {
  label: string
  /** Sub em uppercase ("ABAIXO DE 20%"). */
  hint?: string
  value: string
  tone: Tone
  Icon: LucideIcon
  footer?: string
}

/** Card de item que precisa de atenção. */
export interface ReposicaoItem {
  id: string
  nome: string
  /** "categoria · posto". */
  sub: string
  /** Chave do filtro de status (casa com statusFilters[].id). */
  status: string
  badge: { label: string; tone: Tone }
  /** Barra de nível. `kind` 'pct' → barra proporcional a 100; 'un' → a `max`. */
  bar: { value: number; max: number; kind: 'pct' | 'un'; tone: Tone }
  /** Valor grande ("8,4%" ou "9 un"). */
  big: string
  /** Linha de referência ("1.260 L de 15.000 L" / "9 un · ponto 50"). */
  ref: string
  /** Última compra ("12.000 L · 02/06 · R$ 69 mil"), se houver. */
  ultimaCompra?: string
  /** Sugestão de compra ("Comprar 24.940 L"). */
  sugestao: string
  /** Sub da sugestão ("~12 dias de cobertura"). */
  sugestaoSub?: string
  /** 3ª linha opcional (validade na Conveniência). */
  extraLine?: { text: string; tone: Tone }
}

/** Tudo que os blocos compartilhados precisam pra renderizar uma sub-aba. */
export interface ReposicaoView {
  hero: ReposicaoHero
  /** Os 3 cards de status (o hero é separado). */
  kpis: ReposicaoKpi[]
  /** Opções do filtro de status (segmented). */
  statusFilters: { id: string; label: string }[]
  /** Cards de item JÁ filtrados pelo status ativo. */
  items: ReposicaoItem[]
  /** Texto do "?" do título "Itens que precisam de atenção" (critério). */
  itemsCriterio: string
  /** Título da seção de itens (ex.: "Tanques que precisam de atenção"). */
  itemsTitulo: string
  /** Subtítulo da seção de itens (ordenação). */
  itemsSubtitulo: string
  /** Texto do "?" do título da reposição por posto (fórmula da sugestão). */
  reposicaoFormula: string
}
