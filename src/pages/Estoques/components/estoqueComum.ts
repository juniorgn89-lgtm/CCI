import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import type { SetorEstoque } from '@/pages/Estoques/hooks/useSetorProduto'

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
/** Vende, mas o estoque dá para mais que isso (dias) = encalhando. */
export const DIAS_ENCALHANDO = 90
/** Vendendo devagar: tem saldo e venda, mas estoque para mais de DIAS_ENCALHANDO dias. */
export const ehEncalhando = (r: ProductAnalyticsRow, hoje: string) =>
  !ehParado(r, hoje) && r.saldoAtual > 0 && r.mediaDiariaVendas > 0 && r.diasCobertura > DIAS_ENCALHANDO
/** Travado = parado ou encalhando (a mesma lista do "Como fechar o mês ainda melhor?"). */
export const ehTravado = (r: ProductAnalyticsRow, hoje: string) => ehParado(r, hoje) || ehEncalhando(r, hoje)
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

export type SituacaoProduto =
  | 'todos' | 'com_saldo' | 'zerados' | 'negativos' | 'abaixo_minimo' | 'sem_movimento' | 'ruptura' | 'excesso' | 'parados' | 'travados'
  | 'mais_vendidos' | 'abc_a' | 'abc_b' | 'abc_c'
  | 'estrelas' | 'mina' | 'tracao' | 'reduzir'

/** Filtro inicial da aba Produtos (vindo de um link com ?setor=&situacao=). */
export interface AbrirProdutos { situacao?: SituacaoProduto; categoria?: string; setor?: SetorEstoque }

export type GrupoSituacao = 'Estoque' | 'Venda' | 'Giro × margem'
export const SITUACOES: { v: SituacaoProduto; l: string; grupo: GrupoSituacao; dica?: string }[] = [
  { v: 'todos', l: 'Todos os produtos', grupo: 'Estoque' },
  { v: 'com_saldo', l: 'Com saldo', grupo: 'Estoque' },
  { v: 'ruptura', l: 'Em ruptura ou crítico', grupo: 'Estoque', dica: 'zerados que vendem ou que acabam logo' },
  { v: 'excesso', l: 'Excesso de estoque', grupo: 'Estoque', dica: 'estoque para mais que o dobro da meta' },
  { v: 'parados', l: `Parados (sem venda há +${DIAS_PARADO} dias)`, grupo: 'Estoque' },
  { v: 'travados', l: `Travados (parados ou estoque para +${DIAS_ENCALHANDO} dias)`, grupo: 'Estoque' },
  { v: 'zerados', l: 'Zerados', grupo: 'Estoque' },
  { v: 'negativos', l: 'Saldo negativo', grupo: 'Estoque' },
  { v: 'abaixo_minimo', l: 'Abaixo do mínimo', grupo: 'Estoque' },
  { v: 'sem_movimento', l: 'Sem movimento', grupo: 'Estoque', dica: 'não venderam no período' },
  { v: 'mais_vendidos', l: 'Mais vendidos', grupo: 'Venda', dica: 'do que mais saiu no período para o que menos saiu' },
  { v: 'abc_a', l: 'Curva A', grupo: 'Venda', dica: 'os poucos que fazem 80% do faturamento' },
  { v: 'abc_b', l: 'Curva B', grupo: 'Venda', dica: 'os próximos 15% do faturamento' },
  { v: 'abc_c', l: 'Curva C', grupo: 'Venda', dica: 'os últimos 5% e os que não venderam' },
  { v: 'estrelas', l: 'Estrelas', grupo: 'Giro × margem', dica: 'vendem muito e com margem alta: nunca deixe faltar' },
  { v: 'mina', l: 'Mina de ouro', grupo: 'Giro × margem', dica: 'margem alta, mas vendem pouco: exponha melhor' },
  { v: 'tracao', l: 'Tração', grupo: 'Giro × margem', dica: 'vendem muito, margem baixa: trazem o cliente' },
  { v: 'reduzir', l: 'Reduzir', grupo: 'Giro × margem', dica: 'vendem pouco e com margem baixa: compre menos' },
]

/** Margem bruta % do que foi vendido; sem venda no período, a do cadastro. */
export const margemPct = (r: ProductAnalyticsRow) =>
  r.precoMedioVenda > 0 && r.custoMedio > 0 ? ((r.precoMedioVenda - r.custoMedio) / r.precoMedioVenda) * 100 : r.lucroBrutoPctCadastro
const mediana = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

export interface ClasseProduto { abc: 'A' | 'B' | 'C'; quad: 'estrelas' | 'mina' | 'tracao' | 'reduzir' | null }
/**
 * Curva ABC (pela receita de 6 meses: A até 80% do faturamento, B até 95%, C o
 * resto e quem não vendeu) e Giro × Margem (só quem vendeu na janela; corte na
 * mediana do grupo). As mesmas regras da antiga Visão Geral, sobre a lista dada.
 */
export const classificarProdutos = (rows: ProductAnalyticsRow[]): Map<number, ClasseProduto> => {
  const out = new Map<number, ClasseProduto>()
  const porReceita = [...rows].sort((a, b) => b.receitaUltimos6m - a.receitaUltimos6m)
  const total = porReceita.reduce((n, r) => n + r.receitaUltimos6m, 0)
  let acum = 0
  for (const r of porReceita) {
    acum += r.receitaUltimos6m
    const share = total > 0 ? acum / total : 1
    out.set(r.produtoCodigo, { abc: r.receitaUltimos6m <= 0 ? 'C' : share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C', quad: null })
  }
  const comVenda = rows.filter((r) => r.vendasJanela > 0)
  const giroMed = mediana(comVenda.map((r) => r.giroJanela))
  const margMed = mediana(comVenda.map(margemPct))
  for (const r of comVenda) {
    const altoGiro = r.giroJanela >= giroMed, altaMarg = margemPct(r) >= margMed
    out.get(r.produtoCodigo)!.quad = altoGiro && altaMarg ? 'estrelas' : !altoGiro && altaMarg ? 'mina' : altoGiro ? 'tracao' : 'reduzir'
  }
  return out
}

export const casaSituacao = (r: ProductAnalyticsRow, s: SituacaoProduto, coberturaDias: number, hoje: string, classe?: Map<number, ClasseProduto>) => {
  const c = classe?.get(r.produtoCodigo)
  switch (s) {
    case 'mais_vendidos': return r.vendasJanela > 0
    case 'abc_a': return c?.abc === 'A'
    case 'abc_b': return c?.abc === 'B'
    case 'abc_c': return c?.abc === 'C'
    case 'estrelas': case 'mina': case 'tracao': case 'reduzir': return c?.quad === s
    case 'com_saldo': return r.saldoAtual > 0
    case 'zerados': return r.saldoAtual === 0
    case 'negativos': return r.saldoAtual < 0
    case 'abaixo_minimo': return r.estoqueMinimo > 0 && r.saldoAtual < r.estoqueMinimo
    case 'sem_movimento': return r.vendasJanela === 0
    case 'ruptura': return ehRuptura(r) || ehCritico(r)
    case 'excesso': return valorExcedente(r, coberturaDias, hoje) > 0
    case 'parados': return ehParado(r, hoje)
    case 'travados': return ehTravado(r, hoje)
    default: return true
  }
}
