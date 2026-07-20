/**
 * Classificação de preço do Radar · Visão Geral — por (posto × combustível).
 * A situação sai da MARGEM % (lucro bruto ÷ faturamento). As faixas são
 * TUNÁVEIS (o design é ilustrativo; calibrar ao vivo). Ordem: quanto menor a
 * margem, mais perto do "piso" (custo) e mais arriscado cortar preço.
 */

export type Situacao = 'piso' | 'apertada' | 'saudavel' | 'folga'

/** Faixas de margem (%). Ajustar aqui recalibra toda a tela. */
export const FAIXA_PISO = 5 // < 5% → perto do piso
export const FAIXA_APERTADA = 9 // 5–9% → apertada
export const FAIXA_SAUDAVEL = 11 // 9–11% → saudável · ≥ 11% → folga

export const classificar = (margemPct: number): Situacao => {
  if (margemPct < FAIXA_PISO) return 'piso'
  if (margemPct < FAIXA_APERTADA) return 'apertada'
  if (margemPct < FAIXA_SAUDAVEL) return 'saudavel'
  return 'folga'
}

/** Agrupamento de AÇÃO da aba Resumo (saudável + folga = "dá pra ceder"). */
export type Acao = 'cuidado' | 'atencao' | 'oportunidade'
export const acaoDe = (s: Situacao): Acao =>
  s === 'piso' ? 'cuidado' : s === 'apertada' ? 'atencao' : 'oportunidade'

export interface SituacaoMeta {
  /** Pílula da aba "Todos os cards". */
  pill: string
  /** Cor do ponto/realce (tom). */
  tone: 'red' | 'amber' | 'blue' | 'green'
  /** Veredito curto (manchete). */
  titulo: string
  /** Frase do card (aba Todos os cards). */
  frase: string
}

export const SITUACAO_META: Record<Situacao, SituacaoMeta> = {
  piso: {
    pill: 'No limite',
    tone: 'red',
    titulo: 'Segure o preço — não corte',
    frase: 'Perto do piso — cortar aqui vende no prejuízo.',
  },
  apertada: {
    pill: 'Aperto',
    tone: 'amber',
    titulo: 'Evite cortar sem ganho de volume',
    frase: 'Margem apertada — evite cortar sem ganho de volume.',
  },
  saudavel: {
    pill: 'Estável',
    tone: 'blue',
    titulo: 'Margem saudável — segure e observe',
    frase: 'Margem saudável — segure o preço e observe.',
  },
  folga: {
    pill: 'Folga',
    tone: 'green',
    titulo: 'Pode ceder até o piso saudável',
    frase: 'Folga no preço — dá pra ceder se a concorrência apertar.',
  },
}

export interface AcaoMeta {
  titulo: string
  sub: string
  tone: 'red' | 'amber' | 'green'
}

export const ACAO_META: Record<Acao, AcaoMeta> = {
  cuidado: { titulo: 'Cuidado — perto do piso', sub: 'Prioridade máxima: proteger a margem', tone: 'red' },
  atencao: { titulo: 'Atenção — margem apertada', sub: 'Segure; corte só com ganho de volume', tone: 'amber' },
  oportunidade: { titulo: 'Oportunidade — dá pra ceder', sub: 'Munição de preço se precisar competir', tone: 'green' },
}

/** Classes utilitárias por tom (borda esquerda, texto, pílula, ponto). */
export const TONE_CLASSES: Record<'red' | 'amber' | 'blue' | 'green', { bar: string; text: string; pill: string; dot: string }> = {
  red: {
    bar: 'border-red-500 dark:border-red-500/70',
    text: 'text-red-600 dark:text-red-400',
    pill: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-red-500',
  },
  amber: {
    bar: 'border-amber-500 dark:border-amber-500/70',
    text: 'text-amber-600 dark:text-amber-400',
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  blue: {
    bar: 'border-blue-500 dark:border-blue-500/70',
    text: 'text-blue-600 dark:text-blue-400',
    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  green: {
    bar: 'border-emerald-500 dark:border-emerald-500/70',
    text: 'text-emerald-600 dark:text-emerald-400',
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
}
