import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'

type Nivel = 'critico' | 'alerta' | 'ok'
const ORDEM_NIVEL: Record<Nivel, number> = { critico: 0, alerta: 1, ok: 2 }

/** Um combustível de um posto: os tanques dele somados (é assim que se compra). */
export interface CombustivelPedido {
  produtoCodigo: number
  produto: string
  tanques: number
  atual: number
  capacidade: number
  consumoDia: number
  comprar: number
  /** Menor "dura" entre os tanques (o primeiro que seca). null = sem consumo. */
  secaEmDias: number | null
  /** Algum tanque deste combustível vazio (com consumo). */
  vazio: boolean
  /** Quantos tanques deste combustível estão vazios. */
  tanquesVazios: number
  nivel: Nivel
}

/** Agrupa os tanques de UM posto por combustível, o mais urgente primeiro. */
export const agruparPorCombustivel = (tanques: ReabastTanque[]): CombustivelPedido[] => {
  const m = new Map<number, CombustivelPedido & { niveis: Nivel[] }>()
  for (const t of tanques) {
    const g = m.get(t.produtoCodigo) ?? { produtoCodigo: t.produtoCodigo, produto: t.produtoNome, tanques: 0, atual: 0, capacidade: 0, consumoDia: 0, comprar: 0, secaEmDias: null, vazio: false, tanquesVazios: 0, nivel: 'ok' as Nivel, niveis: [] }
    g.tanques += 1
    g.atual += t.estoqueAtual
    g.capacidade += t.capacidade
    g.consumoDia += t.consumoDiarioMedio
    g.comprar += t.necessidadeFimDoMes
    g.niveis.push(t.nivel)
    if (t.estoqueAtual <= 0 && t.consumoDiarioMedio > 0) { g.vazio = true; g.tanquesVazios += 1 }
    if (t.diasRestantes != null) g.secaEmDias = g.secaEmDias == null ? t.diasRestantes : Math.min(g.secaEmDias, t.diasRestantes)
    m.set(t.produtoCodigo, g)
  }
  return [...m.values()]
    .map(({ niveis, ...g }) => ({ ...g, nivel: niveis.includes('critico') ? 'critico' : niveis.includes('alerta') ? 'alerta' : 'ok' } as CombustivelPedido))
    .sort((a, b) =>
      (a.vazio === b.vazio ? 0 : a.vazio ? -1 : 1)
      || (a.secaEmDias ?? 999) - (b.secaEmDias ?? 999)
      || ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel]
      || b.comprar - a.comprar)
}

/** dd/mm daqui a N dias. */
export const dataDaquiA = (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const secaTexto = (g: { vazio: boolean; secaEmDias: number | null; atual?: number; tanquesVazios?: number }) => {
  // Só um dos tanques zerou e os outros ainda têm produto: não é "vazio".
  if (g.vazio && (g.atual ?? 0) > 0) return `${g.tanquesVazios ?? 1} tanque${(g.tanquesVazios ?? 1) === 1 ? '' : 's'} vazio${(g.tanquesVazios ?? 1) === 1 ? '' : 's'}`
  if (g.vazio) return 'vazio agora'
  if (g.secaEmDias == null) return 'sem consumo no mês'
  if (g.secaEmDias === 0) return 'seca hoje'
  return `seca em ~${g.secaEmDias} dia${g.secaEmDias === 1 ? '' : 's'} (${dataDaquiA(g.secaEmDias)})`
}

/** Vermelho: vazio ou seca em < 3 dias · âmbar: < 7 dias. */
export const secaCls = (g: { vazio: boolean; secaEmDias: number | null }) =>
  g.vazio || (g.secaEmDias != null && g.secaEmDias < 3)
    ? 'text-red-600 dark:text-red-400'
    : g.secaEmDias != null && g.secaEmDias < 7 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200'
