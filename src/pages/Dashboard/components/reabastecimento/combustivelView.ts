import { ShoppingCart, AlertTriangle, Clock, MinusCircle } from 'lucide-react'
import { formatLiters } from '@/lib/formatters'
import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import type { ReposicaoItem, ReposicaoView, Tone } from '@/pages/Dashboard/components/reabastecimento/types'

const pct1 = (v: number): string => `${v.toFixed(1).replace('.', ',')}%`

/** "R$ 487 mil" / "R$ 980". */
const fmtMilRS = (v: number): string =>
  Math.abs(v) >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : `R$ ${Math.round(v)}`

const ddmm = (iso: string): string => {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}/${m}` : iso
}

/** Status (e tom) de um tanque baixo: negativo é ortogonal ao nível. */
const statusDe = (t: ReabastTanque): { status: string; tone: Tone; label: string } => {
  if (t.estoqueAtual < 0) return { status: 'negativo', tone: 'negativo', label: 'Negativo' }
  if (t.nivel === 'critico') return { status: 'critico', tone: 'critico', label: 'Crítico' }
  return { status: 'alerta', tone: 'alerta', label: 'Alerta' }
}

const toItem = (t: ReabastTanque): ReposicaoItem => {
  const s = statusDe(t)
  const uc = t.ultimaCompra
  return {
    id: `${t.empresaCodigo}-${t.tanqueCodigo}`,
    nome: t.tanqueNome,
    sub: `${t.produtoNome} · ${t.empresaNome}`,
    status: s.status,
    badge: { label: s.label, tone: s.tone },
    bar: { value: Math.max(0, t.nivelPct), max: 100, kind: 'pct', tone: s.tone },
    big: pct1(t.nivelPct),
    ref: `${formatLiters(t.estoqueAtual)} de ${formatLiters(t.capacidade)}`,
    ultimaCompra: uc ? `${formatLiters(uc.volume)} · ${ddmm(uc.data)} · ${fmtMilRS(uc.valorEstimado)}` : undefined,
    sugestao: t.necessidadeFimDoMes > 0 ? `Comprar ${formatLiters(t.necessidadeFimDoMes)}` : 'Sem sugestão',
    sugestaoSub: t.diasRestantes != null ? `~${t.diasRestantes} dia${t.diasRestantes === 1 ? '' : 's'}` : undefined,
  }
}

/**
 * Mapeia a saída do `useReabastecimento` (combustível) pro view-model
 * compartilhado. Hero/KPIs usam TODOS os tanques baixos (contadores totais);
 * `items` traz todos (o filtro de status é aplicado pelo orquestrador). Nenhum
 * dado inventado — tudo vem do hook.
 */
export const combustivelView = (baixos: ReabastTanque[], criticos: ReabastTanque[]): ReposicaoView => {
  const totalSugestao = baixos.reduce((s, t) => s + t.necessidadeFimDoMes, 0)
  const totalRS = baixos.reduce((s, t) => s + t.necessidadeFimDoMes * (t.ultimaCompra?.precoCusto ?? 0), 0)
  const postosCount = new Set(baixos.map((t) => t.empresaCodigo)).size
  const nAlerta = baixos.filter((t) => t.estoqueAtual >= 0 && t.nivel === 'alerta').length
  const nNegativo = baixos.filter((t) => t.estoqueAtual < 0).length
  const nCritico = criticos.filter((t) => t.estoqueAtual >= 0).length

  return {
    hero: {
      label: 'Total a comprar',
      hint: 'até o fim do mês',
      value: formatLiters(totalSugestao).replace(' L', ''),
      unit: 'L',
      Icon: ShoppingCart,
      footer: `${baixos.length} ${baixos.length === 1 ? 'tanque' : 'tanques'} · ${postosCount} ${postosCount === 1 ? 'posto' : 'postos'}`,
      footerBadge: totalRS > 0 ? `~${fmtMilRS(totalRS)}` : undefined,
    },
    kpis: [
      { label: 'Críticos', hint: 'abaixo de 20%', value: String(nCritico), tone: 'critico', Icon: AlertTriangle, footer: 'tanques · risco de ruptura' },
      { label: 'Em alerta', hint: '20% a 30%', value: String(nAlerta), tone: 'alerta', Icon: Clock, footer: 'tanques · planejar compra' },
      { label: 'Estoque negativo', hint: 'inconsistência', value: String(nNegativo), tone: 'negativo', Icon: MinusCircle, footer: 'conferir entrada de nota' },
    ],
    statusFilters: [
      { id: 'todos', label: 'Todos' },
      { id: 'critico', label: 'Críticos' },
      { id: 'alerta', label: 'Alerta' },
      { id: 'negativo', label: 'Negativo' },
    ],
    items: baixos.map(toItem),
    itemsTitulo: 'Tanques que precisam de atenção',
    itemsSubtitulo: 'Ordenados por criticidade · nível abaixo de 30%',
    itemsCriterio: 'Tanques com nível abaixo de 30%: crítico (<20%, risco de ruptura), alerta (20–30%) e estoque negativo (escritural < 0 — nota de entrada não lançada). Ordenados do menor nível ao maior.',
    reposicaoFormula: 'Sugestão = consumo médio diário × dias restantes do mês − estoque atual.',
  }
}
