import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { custoUnit, precoUnit, ehParado, ehEncalhando, DIAS_ENCALHANDO } from '@/pages/Estoques/components/estoqueComum'

/**
 * "Destravar estoque" — base do botão "Como fechar o mês ainda melhor?" para
 * Automotivos e Conveniência. Tudo determinístico (sem IA), por posto:
 *
 * 1. Travados: produtos com saldo que pararam de vender (sem venda há +90 dias)
 *    ou que estão encalhando (vendem, mas o estoque dá para mais de 90 dias).
 * 2. Kits: cada travado junto de um produto que gira bem. O par vem, nesta ordem,
 *    de: (a) cupons em que os dois saíram juntos; (b) cupons de quem compra a
 *    mesma categoria do travado; (c) sem cupom que sustente → o mais vendido da
 *    MESMA categoria, marcado como SUGESTÃO (não é comportamento observado e não
 *    entra no total "a mais no mês"). Sem nada na categoria, não há kit.
 *
 * Conta honesta do ganho: quem leva o parceiro já ia levar de qualquer jeito, então
 * o lucro A MAIS do kit é só a margem do travado menos o desconto. E só dá para
 * oferecer o kit a quem vai comprar o parceiro até o fim do mês.
 */

export type Setor = 'automotivos' | 'conveniencia'

export { DIAS_ENCALHANDO }
/** Cupons mínimos para dizer "costumam levar junto". */
export const MIN_CUPONS = 3

export type FonteKit = 'produto' | 'categoria' | 'sugestao'

export interface Travado {
  r: ProductAnalyticsRow
  motivo: 'parado' | 'encalhando'
  /** Dias desde a última venda (null = não vendeu nos últimos 6 meses). */
  diasSemVenda: number | null
  preco: number
  custo: number
  /** Saldo × custo: dinheiro empatado. */
  empatado: number
  /** Saldo × (preço − custo), se vender tudo pelo preço cheio. */
  lucroSeVender: number
}

export interface Kit {
  t: Travado
  parceiro: ProductAnalyticsRow
  fonte: FonteKit
  /** Cupons que sustentam o par (0 na sugestão). */
  cupons: number
  precoParceiro: number
  precoCheio: number
  desconto: number
  precoKit: number
  /** Lucro A MAIS por kit = margem do travado − desconto. */
  lucroExtra: number
  /** Kits que dá para vender até o fim do mês (saldo e saída do parceiro). */
  kitsMes: number
  lucroMes: number
  /** Dinheiro que volta para o caixa no mês (preço do travado − desconto). */
  caixaMes: number
  /** Os compradores do parceiro até o fim do mês já foram contados em outro kit. */
  parceiroOcupado: boolean
}

const diasEntre = (iso: string, hoje: string) =>
  Math.round((new Date(`${hoje}T12:00:00`).getTime() - new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()) / 86400000)

const centavos = (v: number) => Math.round(v * 100) / 100

export const travadosDe = (rows: ProductAnalyticsRow[], noSetor: (codigo: number) => boolean, hoje: string): Travado[] =>
  rows
    .filter((r) => r.saldoAtual > 0 && noSetor(r.produtoCodigo))
    .map((r): Travado | null => {
      const parado = ehParado(r, hoje)
      const encalhando = ehEncalhando(r, hoje)
      if (!parado && !encalhando) return null
      const preco = precoUnit(r)
      const custo = custoUnit(r)
      return {
        r,
        motivo: parado ? 'parado' : 'encalhando',
        diasSemVenda: r.ultimaVenda ? diasEntre(r.ultimaVenda, hoje) : null,
        preco,
        custo,
        empatado: r.saldoAtual * custo,
        lucroSeVender: preco > 0 && custo > 0 ? r.saldoAtual * Math.max(0, preco - custo) : 0,
      }
    })
    .filter((t): t is Travado => t !== null)
    .sort((a, b) => b.empatado - a.empatado)

/** Desconto sugerido no travado: até 10% do kit, sem passar de 60% da margem dele (múltiplo de R$ 0,10). */
export const descontoKit = (precoT: number, custoT: number, precoP: number) => {
  const margemT = precoT - custoT
  if (margemT <= 0) return 0
  const d = Math.floor(Math.min(0.1 * (precoT + precoP), 0.6 * margemT) * 10) / 10
  return d >= 0.1 ? centavos(d) : 0
}

export const montarKits = ({ travados, rows, noSetor, cestas, diasRestantes }: {
  travados: Travado[]
  rows: ProductAnalyticsRow[]
  noSetor: (codigo: number) => boolean
  cestas: number[][]
  diasRestantes: number
}): Kit[] => {
  const porCodigo = new Map(rows.map((r) => [r.produtoCodigo, r]))
  const travadoSet = new Set(travados.map((t) => t.r.produtoCodigo))
  // Parceiro bom: mesmo setor, com saldo, vendendo, com preço e margem.
  const bom = (r: ProductAnalyticsRow | undefined): r is ProductAnalyticsRow =>
    !!r && noSetor(r.produtoCodigo) && !travadoSet.has(r.produtoCodigo) && r.saldoAtual > 0 && r.mediaDiariaVendas > 0 &&
    precoUnit(r) > 0 && custoUnit(r) > 0 && precoUnit(r) > custoUnit(r)

  // Contagens dos cupons: travado × produto e categoria × produto.
  const porProduto = new Map<number, Map<number, number>>()
  const porCategoria = new Map<string, Map<number, number>>()
  const soma = (m: Map<number, number>, k: number) => m.set(k, (m.get(k) ?? 0) + 1)
  for (const cesta of cestas) {
    const itens = cesta.map((c) => porCodigo.get(c)).filter((r): r is ProductAnalyticsRow => !!r && noSetor(r.produtoCodigo))
    if (itens.length < 2) continue
    const categorias = new Set(itens.map((r) => r.categoria))
    for (const a of itens) {
      if (travadoSet.has(a.produtoCodigo)) {
        const m = porProduto.get(a.produtoCodigo) ?? new Map<number, number>()
        for (const b of itens) if (b.produtoCodigo !== a.produtoCodigo) soma(m, b.produtoCodigo)
        porProduto.set(a.produtoCodigo, m)
      }
    }
    for (const cat of categorias) {
      const m = porCategoria.get(cat) ?? new Map<number, number>()
      for (const b of itens) if (b.categoria !== cat) soma(m, b.produtoCodigo)
      porCategoria.set(cat, m)
    }
  }
  const melhor = (m: Map<number, number> | undefined, excluir: number) => {
    let top: { r: ProductAnalyticsRow; n: number } | null = null
    for (const [cod, n] of m ?? []) {
      if (cod === excluir || n < MIN_CUPONS) continue
      const r = porCodigo.get(cod)
      if (!bom(r)) continue
      if (!top || n > top.n || (n === top.n && r.vendasJanela > top.r.vendasJanela)) top = { r, n }
    }
    return top
  }
  const maisVendidos = rows.filter(bom).sort((a, b) => b.vendasJanela - a.vendasJanela)

  // Saída prevista de cada parceiro até o fim do mês (a quem dá para oferecer o kit).
  const capacidade = new Map<number, number>()
  const capDe = (r: ProductAnalyticsRow) => capacidade.get(r.produtoCodigo) ?? Math.min(Math.floor(r.saldoAtual), Math.ceil(r.mediaDiariaVendas * Math.max(0, diasRestantes)))

  const kits: Kit[] = []
  for (const t of travados) {
    if (t.preco <= 0 || t.custo <= 0) continue
    const doProduto = melhor(porProduto.get(t.r.produtoCodigo), t.r.produtoCodigo)
    const daCategoria = doProduto ? null : melhor(porCategoria.get(t.r.categoria), t.r.produtoCodigo)
    // Sem cupom: só o mais vendido da MESMA categoria ("leve os dois"). Juntar com qualquer
    // campeão da loja dava pares sem sentido (cartão pré-pago + pão de queijo).
    const sugestao = doProduto || daCategoria ? null : (maisVendidos.find((r) => r.categoria === t.r.categoria) ?? null)
    const par = doProduto ?? daCategoria
    const parceiro = par?.r ?? sugestao
    if (!parceiro) continue
    const precoParceiro = precoUnit(parceiro)
    const desconto = descontoKit(t.preco, t.custo, precoParceiro)
    const precoCheio = centavos(t.preco + precoParceiro)
    kits.push({
      t, parceiro,
      fonte: doProduto ? 'produto' : daCategoria ? 'categoria' : 'sugestao',
      cupons: par?.n ?? 0,
      precoParceiro, precoCheio, desconto,
      precoKit: centavos(precoCheio - desconto),
      lucroExtra: Math.max(0, t.preco - t.custo - desconto),
      kitsMes: 0, lucroMes: 0, caixaMes: 0, parceiroOcupado: false,
    })
  }
  // Reparte a saída de cada parceiro entre os kits (o de maior lucro por kit primeiro):
  // o mesmo cliente não leva dois kits com o mesmo parceiro.
  for (const k of [...kits].sort((a, b) => b.lucroExtra - a.lucroExtra)) {
    const cap = capDe(k.parceiro)
    k.parceiroOcupado = cap <= 0 && capacidade.has(k.parceiro.produtoCodigo)
    const n = Math.max(0, Math.min(Math.floor(k.t.r.saldoAtual), cap))
    capacidade.set(k.parceiro.produtoCodigo, cap - n)
    k.kitsMes = n
    k.lucroMes = n * k.lucroExtra
    k.caixaMes = n * (k.t.preco - k.desconto)
  }
  // Os de comportamento observado primeiro; dentro de cada fonte, o maior ganho no mês.
  const ordemFonte: Record<FonteKit, number> = { produto: 0, categoria: 1, sugestao: 2 }
  return kits.sort((a, b) => ordemFonte[a.fonte] - ordemFonte[b.fonte] || b.lucroMes - a.lucroMes || b.t.empatado - a.t.empatado)
}
