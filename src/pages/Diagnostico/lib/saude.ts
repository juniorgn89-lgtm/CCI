import type { Pilar, StatusPilar } from '@/pages/Diagnostico/lib/pilares'

/**
 * Saúde do posto / da rede: uma nota de 0 a 100 tirada dos cinco pilares, com
 * pesos fixos e níveis declarados. Nada de IA: pilar "Bem" vale 100, "Atenção"
 * vale 50, "Crítico" vale 0; pilar sem dado fica FORA da conta (e isso é dito),
 * em vez de puxar a nota pra baixo ou pra cima.
 */

export type NivelSaude = 'saudavel' | 'atencao' | 'critico' | 'sem_dado'

export interface Saude {
  pontos: number | null
  nivel: NivelSaude
  /** Pilares com dado que entraram na conta. */
  consideradas: number
  total: number
  /** Pilares que puxam a nota pra baixo (crítico primeiro, depois atenção), do maior peso pro menor. */
  pesam: Pilar[]
  /** Pilares sem dado (fora da conta). */
  semDado: Pilar[]
}

/** Peso de cada pilar na nota (soma 100). Venda e financeiro mandam. */
export const PESO_PILAR: Record<string, number> = { venda: 35, financeiro: 25, loja: 15, pista: 15, vendedores: 10 }
const PONTOS_STATUS: Record<Exclude<StatusPilar, 'sem_dado'>, number> = { bom: 100, atencao: 50, critico: 0 }

/** Faixas da nota — as mesmas que a tela mostra na régua. */
export const FAIXAS_SAUDE: { nivel: Exclude<NivelSaude, 'sem_dado'>; de: number; ate: number; rotulo: string; descricao: string }[] = [
  { nivel: 'critico', de: 0, ate: 49, rotulo: 'Crítico', descricao: 'Há pilar em situação crítica ou vários em atenção. Precisa de ação agora.' },
  { nivel: 'atencao', de: 50, ate: 74, rotulo: 'Em atenção', descricao: 'A base está de pé, mas algo importante está escorregando.' },
  { nivel: 'saudavel', de: 75, ate: 100, rotulo: 'Saudável', descricao: 'Venda, margem, equipe e financeiro no lugar. Trabalho agora é manter.' },
]

export const nivelDe = (pontos: number): Exclude<NivelSaude, 'sem_dado'> => (pontos >= 75 ? 'saudavel' : pontos >= 50 ? 'atencao' : 'critico')
export const rotuloNivel = (n: NivelSaude) => (n === 'sem_dado' ? 'Sem base' : FAIXAS_SAUDE.find((f) => f.nivel === n)!.rotulo)

export const calcularSaude = (pilares: Pilar[]): Saude => {
  const comDado = pilares.filter((p) => p.status !== 'sem_dado')
  const semDado = pilares.filter((p) => p.status === 'sem_dado')
  const pesoTotal = comDado.reduce((s, p) => s + (PESO_PILAR[p.id] ?? 10), 0)
  if (comDado.length === 0 || pesoTotal === 0) return { pontos: null, nivel: 'sem_dado', consideradas: 0, total: pilares.length, pesam: [], semDado }
  const soma = comDado.reduce((s, p) => s + (PESO_PILAR[p.id] ?? 10) * PONTOS_STATUS[p.status as Exclude<StatusPilar, 'sem_dado'>], 0)
  const pontos = Math.round(soma / pesoTotal)
  const ordem: Record<StatusPilar, number> = { critico: 0, atencao: 1, bom: 2, sem_dado: 3 }
  const pesam = comDado
    .filter((p) => p.status !== 'bom')
    .sort((a, b) => ordem[a.status] - ordem[b.status] || (PESO_PILAR[b.id] ?? 10) - (PESO_PILAR[a.id] ?? 10))
  return { pontos, nivel: nivelDe(pontos), consideradas: comDado.length, total: pilares.length, pesam, semDado }
}
