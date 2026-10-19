import { horizonteDe, type Horizonte } from '@/pages/Dashboard/hooks/useContasResumo'
import { todayLocal } from '@/lib/period'

/**
 * Filtro que chega pela URL quando o usuário vem de um modal de contas
 * (Central/Dashboard): faixa de vencimento, categoria e busca. As tabelas de
 * Receber e Pagar aplicam igual ao modal, então a lista bate com o que ele via.
 */
export interface FiltroLink {
  faixas: Horizonte[] | null
  cat: string | null
  q: string
  /** Rótulo do que foi clicado (ex.: "Próximos 7 dias", "Boleto"). */
  rotulo: string
}

const FAIXAS: Horizonte[] = ['vencidas', 'hoje', 'd7', 'd30', 'depois']

/** Só vale na aba para a qual o link foi feito (`tab` da URL = lado). */
export const lerFiltroLink = (sp: URLSearchParams, lado?: 'pagar' | 'receber'): FiltroLink | null => {
  if (lado && sp.get('tab') !== lado) return null
  const faixas = (sp.get('faixa') ?? '').split(',').filter((f): f is Horizonte => (FAIXAS as string[]).includes(f))
  const cat = sp.get('cat')
  const q = (sp.get('q') ?? '').trim()
  if (!faixas.length && !cat && !q) return null
  return { faixas: faixas.length ? faixas : null, cat, q, rotulo: sp.get('rotulo') ?? '' }
}

export const linkFinanceiro = (lado: 'pagar' | 'receber', f: { faixas?: Horizonte[]; cat?: string; q?: string; rotulo?: string }) => {
  const sp = new URLSearchParams({ tab: lado })
  if (f.faixas?.length) sp.set('faixa', f.faixas.join(','))
  if (f.cat) sp.set('cat', f.cat)
  if (f.q?.trim()) sp.set('q', f.q.trim())
  if (f.rotulo) sp.set('rotulo', f.rotulo)
  return `/financeiro?${sp.toString()}`
}

/** A linha passa no filtro do link? (a categoria é aplicada pelo filtro de instrumento da tabela) */
export const casaFiltroLink = (f: FiltroLink | null, r: { vencimento: string; textos: string[] }) => {
  if (!f) return true
  if (f.faixas && !f.faixas.includes(horizonteDe(r.vencimento, todayLocal()))) return false
  if (f.q) {
    const q = f.q.toLowerCase()
    if (!r.textos.some((t) => (t ?? '').toLowerCase().includes(q))) return false
  }
  return true
}

/** Tira os parâmetros do filtro da URL atual (mantém a aba). */
export const PARAMS_FILTRO_LINK = ['faixa', 'cat', 'q', 'rotulo']

export const semFiltroLink = (sp: URLSearchParams) => {
  const n = new URLSearchParams(sp)
  for (const k of PARAMS_FILTRO_LINK) n.delete(k)
  return n
}
