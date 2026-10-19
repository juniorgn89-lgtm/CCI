import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

/**
 * Vocabulário ÚNICO do módulo Estoques (antes "Crítico/Baixo/Zerados/Em falta"
 * diziam quase a mesma coisa com regras diferentes). Regras do hook:
 * negativo = saldo < 0 · urgente = zerado com venda OU dura menos da metade da
 * meta · cobertura curta = dura menos que a meta · sem movimento = não vendeu
 * na janela.
 */
export const STATUS_ESTOQUE: Record<ProductAnalyticsRow['necessidadeStatus'], { label: string; color: string; bg: string; dot: string }> = {
  negativo: { label: 'Saldo negativo', color: 'text-red-100', bg: 'bg-red-900 dark:bg-red-950', dot: 'bg-red-900' },
  critico: { label: 'Urgente', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', dot: 'bg-red-500' },
  baixo: { label: 'Cobertura curta', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', dot: 'bg-amber-500' },
  ok: { label: 'OK', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', dot: 'bg-green-500' },
  sem_movimento: { label: 'Sem movimento', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', dot: 'bg-gray-400' },
}

export const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)

export const fmtDataBR = (iso: string | null): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** 'YYYY-MM' → 'out/26'. */
export const fmtMes = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MESES[Number(m) - 1] ?? m}/${(y ?? '').slice(2)}`
}

/** Busca por nome, Ref. ou código de barras (igual em todas as abas). */
export const casaBusca = (r: ProductAnalyticsRow, busca: string) => {
  const b = busca.trim().toLowerCase()
  if (!b) return true
  return r.produtoNome.toLowerCase().includes(b) || r.codigoSku.toLowerCase().includes(b) || (r.codigoBarras ?? '').toLowerCase().includes(b)
}

// ─── Regras da Visão Geral (as mesmas no filtro da aba Produtos) ───────────────

/** Sem venda há mais que isso (com saldo) = parado. */
export const DIAS_PARADO = 90
/** Dura mais que N × a meta de cobertura = excesso. */
export const FATOR_EXCESSO = 2

const diasDesde = (iso: string, hoje: string) =>
  Math.round((new Date(`${hoje}T12:00:00`).getTime() - new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()) / 86400000)

/** Custo unitário de valorização: o do cadastro (ERP); sem ele, o custo médio. */
export const custoUnit = (r: ProductAnalyticsRow) => (r.precoCustoCadastro > 0 ? r.precoCustoCadastro : r.custoMedio)
/** Preço de venda unitário: o do cadastro (tabela A); sem ele, o preço médio vendido. */
export const precoUnit = (r: ProductAnalyticsRow) => (r.precoVendaCadastro > 0 ? r.precoVendaCadastro : r.precoMedioVenda)

/** Tem saldo e não vende há mais de DIAS_PARADO dias (ou não vendeu nos 6 meses). */
export const ehParado = (r: ProductAnalyticsRow, hoje: string) =>
  r.saldoAtual > 0 && (r.ultimaVenda == null || diasDesde(r.ultimaVenda, hoje) > DIAS_PARADO)
/** Zerado (ou negativo) e ainda vende: está perdendo venda. */
export const ehRuptura = (r: ProductAnalyticsRow) => r.saldoAtual <= 0 && r.mediaDiariaVendas > 0
/** Tem saldo, mas dura menos da metade da meta. */
export const ehCritico = (r: ProductAnalyticsRow) => r.saldoAtual > 0 && r.necessidadeStatus === 'critico'
/** R$ acima da meta de cobertura em quem dura mais que FATOR_EXCESSO × a meta (0 se não é excesso). */
export const valorExcedente = (r: ProductAnalyticsRow, coberturaDias: number, hoje: string) => {
  if (r.saldoAtual <= 0 || r.mediaDiariaVendas <= 0 || ehParado(r, hoje)) return 0
  if (r.diasCobertura <= coberturaDias * FATOR_EXCESSO) return 0
  return Math.max(0, r.saldoAtual - r.mediaDiariaVendas * coberturaDias) * custoUnit(r)
}

export type SituacaoProduto = 'todos' | 'com_saldo' | 'zerados' | 'negativos' | 'abaixo_minimo' | 'sem_movimento' | 'ruptura' | 'excesso' | 'parados'

export const SITUACOES: { v: SituacaoProduto; l: string }[] = [
  { v: 'todos', l: 'Todos os produtos' },
  { v: 'com_saldo', l: 'Com saldo' },
  { v: 'ruptura', l: 'Em ruptura ou crítico' },
  { v: 'excesso', l: 'Excesso de estoque' },
  { v: 'parados', l: `Parados (sem venda há +${DIAS_PARADO} dias)` },
  { v: 'zerados', l: 'Zerados' },
  { v: 'negativos', l: 'Saldo negativo' },
  { v: 'abaixo_minimo', l: 'Abaixo do mínimo' },
  { v: 'sem_movimento', l: 'Sem movimento' },
]

export const casaSituacao = (r: ProductAnalyticsRow, s: SituacaoProduto, coberturaDias: number, hoje: string) => {
  switch (s) {
    case 'com_saldo': return r.saldoAtual > 0
    case 'zerados': return r.saldoAtual === 0
    case 'negativos': return r.saldoAtual < 0
    case 'abaixo_minimo': return r.estoqueMinimo > 0 && r.saldoAtual < r.estoqueMinimo
    case 'sem_movimento': return r.vendasJanela === 0
    case 'ruptura': return ehRuptura(r) || ehCritico(r)
    case 'excesso': return valorExcedente(r, coberturaDias, hoje) > 0
    case 'parados': return ehParado(r, hoje)
    default: return true
  }
}
