import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import type { UltimaCompra } from '@/pages/Estoques/hooks/useUltimaCompra'

/**
 * Análise rápida dos produtos que VENDEM: procura o que está estranho no
 * cadastro, no estoque e nas notas de entrada. Regras fixas, sem IA — cada
 * achado traz os números que o geraram e o que fazer.
 */

export type TipoAchado = 'sem_estoque' | 'custo_zerado' | 'abaixo_custo' | 'compra_fora' | 'preco_nao_acompanhou'

export interface Achado {
  tipo: TipoAchado
  produto: ProductAnalyticsRow
  /** R$ em jogo (ordena do maior para o menor). */
  impacto: number
  /** Frase com os números. */
  detalhe: string
}

export const TIPOS: Record<TipoAchado, { titulo: string; oQueFazer: string }> = {
  sem_estoque: { titulo: 'Vendendo sem estoque', oQueFazer: 'Confira se a última nota de entrada foi lançada no ERP e se a unidade está certa (caixa × unidade).' },
  custo_zerado: { titulo: 'Custo zerado, mas vendendo', oQueFazer: 'Cadastre o custo no ERP: sem ele, o lucro deste produto aparece inflado em todo o Visor.' },
  abaixo_custo: { titulo: 'Vendendo abaixo do custo', oQueFazer: 'Ajuste o preço de venda: cada unidade vendida dá prejuízo.' },
  compra_fora: { titulo: 'Última compra fora do normal', oQueFazer: 'Confira a nota: pode ser erro de digitação ou de unidade. Se for aumento real do fornecedor, reveja o preço.' },
  preco_nao_acompanhou: { titulo: 'Custo subiu e o preço não acompanhou', oQueFazer: 'Reajuste o preço de venda para recuperar a margem.' },
}
export const ORDEM_TIPOS: TipoAchado[] = ['abaixo_custo', 'sem_estoque', 'custo_zerado', 'compra_fora', 'preco_nao_acompanhou']

/** Última compra fora do normal: ± este tanto contra a mediana das compras anteriores. */
export const LIMITE_COMPRA = 0.2
/** Custo subiu pelo menos isso (e menos que LIMITE_COMPRA) → olhar o preço. */
const SUBIU_MIN = 0.05

const mediana = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const pct = (v: number) => `${(v * 100).toFixed(0)}%`
const un = (v: number) => (Math.round(v * 100) / 100).toLocaleString('pt-BR')
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export interface EscopoAnalise { quantos: number | 'todos'; setor: string; categoria: string }

/** Item dado de propósito (cortesia, brinde): preço simbólico, não é erro de preço. */
const ehCortesia = (nome: string) => /CORTESIA|BRINDE/i.test(nome)

export const analisarProdutos = (
  produtos: ProductAnalyticsRow[],
  historico: Map<number, UltimaCompra[]>,
): Achado[] => {
  const out: Achado[] = []
  for (const p of produtos) {
    const hist = historico.get(p.produtoCodigo) ?? []
    const ultima = hist[hist.length - 1]
    const anteriores = hist.slice(0, -1).map((h) => h.custo)
    const medAnt = anteriores.length > 0 ? mediana(anteriores) : null
    const custoRef = ultima?.custo ?? (p.precoCustoCadastro > 0 ? p.precoCustoCadastro : 0)
    const preco = p.precoVendaCadastro > 0 ? p.precoVendaCadastro : p.precoMedioVenda
    // "Vendendo…": sem venda no período não há prejuízo nem lucro errado para mostrar.
    const vendeu = p.vendasJanela > 0

    if (vendeu && p.saldoAtual <= 0) {
      out.push({ tipo: 'sem_estoque', produto: p, impacto: p.receitaJanela,
        detalhe: `Saldo ${un(p.saldoAtual)} e vendeu ${un(p.vendasJanela)} no período (${brl(p.receitaJanela)}).` })
    }
    if (vendeu && p.precoCustoCadastro <= 0 && !ultima) {
      out.push({ tipo: 'custo_zerado', produto: p, impacto: p.receitaJanela,
        detalhe: `Sem custo no cadastro e sem nota de entrada no último ano; vendeu ${brl(p.receitaJanela)} no período.` })
    }
    if (vendeu && preco > 0 && custoRef > 0 && preco < custoRef && !ehCortesia(p.produtoNome)) {
      out.push({ tipo: 'abaixo_custo', produto: p, impacto: (custoRef - preco) * p.vendasJanela,
        detalhe: `Vende a ${brl(preco)} e ${ultima ? `a última compra (${dataBR(ultima.data)}) custou` : 'o custo do cadastro é'} ${brl(custoRef)}: ${brl(custoRef - preco)} de prejuízo por unidade.` })
    }
    if (ultima && medAnt != null && medAnt > 0) {
      const varia = ultima.custo / medAnt - 1
      if (Math.abs(varia) >= LIMITE_COMPRA) {
        out.push({ tipo: 'compra_fora', produto: p, impacto: Math.abs(ultima.custo - medAnt) * Math.max(ultima.quantidade, 1),
          detalhe: `Última nota (${dataBR(ultima.data)}): ${brl(ultima.custo)}, ${varia > 0 ? 'acima' : 'abaixo'} ${pct(Math.abs(varia))} do normal (${brl(medAnt)}, mediana de ${anteriores.length} ${anteriores.length === 1 ? 'compra anterior' : 'compras anteriores'}).` })
      } else if (varia >= SUBIU_MIN && preco > custoRef) {
        const margemAntes = (preco - medAnt) / preco
        const margemAgora = (preco - ultima.custo) / preco
        if (margemAntes - margemAgora >= 0.03) {
          out.push({ tipo: 'preco_nao_acompanhou', produto: p, impacto: (ultima.custo - medAnt) * p.vendasJanela,
            detalhe: `Custo subiu ${pct(varia)} (${brl(medAnt)} → ${brl(ultima.custo)}) e o preço segue ${brl(preco)}: margem caiu de ${pct(margemAntes)} para ${pct(margemAgora)}.` })
        }
      }
    }
  }
  return out.sort((a, b) => b.impacto - a.impacto)
}

/** Última compra contra o normal (mediana das anteriores do ano). null = sem base para comparar. */
export const variacaoUltimaCompra = (hist: UltimaCompra[] | undefined): { ultima: UltimaCompra; normal: number; varia: number } | null => {
  if (!hist || hist.length < 2) return null
  const ultima = hist[hist.length - 1]
  const normal = mediana(hist.slice(0, -1).map((h) => h.custo))
  if (!(normal > 0)) return null
  return { ultima, normal, varia: ultima.custo / normal - 1 }
}

/** Faixa visual da variação: alta forte (vermelho), alta leve (âmbar), queda forte (azul), normal. */
export const faixaVariacao = (varia: number): 'alta' | 'subiu' | 'caiu' | 'normal' =>
  varia >= LIMITE_COMPRA ? 'alta' : varia >= SUBIU_MIN ? 'subiu' : varia <= -LIMITE_COMPRA ? 'caiu' : 'normal'
