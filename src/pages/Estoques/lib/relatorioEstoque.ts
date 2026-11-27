import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import type { UltimaCompra } from '@/pages/Estoques/hooks/useUltimaCompra'
import type { SetorEstoque } from '@/pages/Estoques/hooks/useSetorProduto'
import { analisarProdutos, variacaoUltimaCompra, TIPOS, type TipoAchado } from '@/pages/Estoques/lib/analiseProdutos'

/** Ordem do relatório: primeiro o que custa dinheiro todo mês, depois o que já foi pago, por fim o cadastro. */
const ORDEM_RELATORIO: TipoAchado[] = ['abaixo_custo', 'preco_nao_acompanhou', 'compra_fora', 'sem_estoque', 'custo_zerado']
import { formatCurrencyInt } from '@/lib/formatters'

/**
 * Relatório "Analisar estoque": os mesmos sinais da tabela, somados em dinheiro
 * e escritos em frase de dono. Combustível fica de fora (estoque de tanque tem
 * outra lógica). Tudo vem do ERP (GET) — nada é alterado.
 *
 * Contas (sempre "por mês" = janela de venda escalada para 30 dias):
 * - Vendendo abaixo do custo → prejuízo/mês = (custo − preço) × vendido.
 * - Custo subiu e o preço não → lucro que deixa de entrar/mês = (custo novo − custo normal) × vendido.
 * - Última compra fora do normal → acima: quanto pagou a mais na última nota
 *   (custo da nota − normal) × quantidade; abaixo: só a contagem (pode ser erro).
 * - Vendendo sem estoque / custo zerado → não é prejuízo direto: é o tanto de
 *   venda cujo lucro aparece ERRADO no Visor (por isso não entra no "em jogo").
 */

export type SetorRelatorio = Extract<SetorEstoque, 'automotivos' | 'conveniencia'>
export const SETORES_RELATORIO: SetorRelatorio[] = ['automotivos', 'conveniencia']

export interface ProdutoDoSinal { nome: string; ref: string; valor: number }

export interface LinhaSinal {
  tipo: TipoAchado
  titulo: string
  produtos: number
  /** R$ do sinal (o significado depende do tipo — ver `frase`). */
  valor: number
  /** Frase curta de dono, já com os números. */
  frase: string
  /** O que fazer (do vocabulário da análise). */
  oQueFazer: string
  /** Os 3 que mais pesam. */
  top: ProdutoDoSinal[]
  /** Notas abaixo do normal (só em "Última compra fora do normal"). */
  abaixo?: number
}

export interface BlocoRelatorio {
  produtosAnalisados: number
  /** Quantos venderam na janela (0 = setor parado neste posto). */
  produtosVendidos: number
  /** Prejuízo + lucro que deixa de entrar, por mês. */
  emJogoMes: number
  /** Pago a mais nas últimas notas fora do normal (uma vez). */
  pagoAMais: number
  /** Venda com lucro errado no Visor (sem estoque ou sem custo), por mês. */
  vendaComLucroErrado: number
  linhas: LinhaSinal[]
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const montarBloco = (produtos: ProductAnalyticsRow[], historico: Map<number, UltimaCompra[]>, janelaDias: number): BlocoRelatorio => {
  const porMes = janelaDias > 0 ? 30 / janelaDias : 1
  const achados = analisarProdutos(produtos, historico)
  const linhas: LinhaSinal[] = []
  let emJogoMes = 0
  let pagoAMais = 0
  let vendaComLucroErrado = 0
  for (const tipo of ORDEM_RELATORIO) {
    const doTipo = achados.filter((a) => a.tipo === tipo)
    if (doTipo.length === 0) continue
    const n = doTipo.length
    let valor = 0
    let frase = ''
    let abaixo: number | undefined
    let top = doTipo
    if (tipo === 'abaixo_custo') {
      valor = doTipo.reduce((s, a) => s + a.impacto, 0) * porMes
      emJogoMes += valor
      frase = `${n === 1 ? '1 produto vendido por menos do que custa' : `${n} produtos vendidos por menos do que custam`}. Se continuar assim: ${formatCurrencyInt(valor)} de prejuízo por mês.`
    } else if (tipo === 'preco_nao_acompanhou') {
      valor = doTipo.reduce((s, a) => s + a.impacto, 0) * porMes
      emJogoMes += valor
      frase = `${n === 1 ? '1 produto ficou mais caro' : `${n} produtos ficaram mais caros`} para comprar e o preço de venda não subiu. Deixa de entrar ${formatCurrencyInt(valor)} de lucro por mês.`
    } else if (tipo === 'compra_fora') {
      const acima = doTipo.filter((a) => (variacaoUltimaCompra(historico.get(a.produto.produtoCodigo))?.varia ?? 0) > 0)
      abaixo = n - acima.length
      valor = acima.reduce((s, a) => s + a.impacto, 0)
      pagoAMais += valor
      top = acima.length ? acima : doTipo
      frase = [
        acima.length ? `${acima.length === 1 ? '1 nota veio bem mais cara' : `${acima.length} notas vieram bem mais caras`} que o normal: ${formatCurrencyInt(valor)} pagos a mais na última compra.` : null,
        abaixo ? `${abaixo === 1 ? '1 nota veio bem mais barata' : `${abaixo} notas vieram bem mais baratas`}: confira, pode ser erro de digitação ou de unidade.` : null,
      ].filter(Boolean).join(' ')
    } else if (tipo === 'sem_estoque') {
      valor = doTipo.reduce((s, a) => s + a.impacto, 0) * porMes
      vendaComLucroErrado += valor
      frase = `${plural(n, 'produto vende', 'produtos vendem')} com o estoque zerado ou negativo no sistema: ${formatCurrencyInt(valor)} por mês vendidos sem nota de entrada lançada. O lucro dessas vendas pode estar errado.`
    } else {
      valor = doTipo.reduce((s, a) => s + a.impacto, 0) * porMes
      vendaComLucroErrado += valor
      frase = `${plural(n, 'produto vende', 'produtos vendem')} sem custo no cadastro: ${formatCurrencyInt(valor)} por mês em vendas que aparecem com lucro maior do que o real.`
    }
    linhas.push({
      tipo, titulo: TIPOS[tipo].titulo, produtos: n, valor, frase, oQueFazer: TIPOS[tipo].oQueFazer, abaixo,
      top: top.slice(0, 3).map((a) => ({ nome: a.produto.produtoNome, ref: a.produto.codigoSku, valor: a.impacto })),
    })
  }
  return { produtosAnalisados: produtos.length, produtosVendidos: produtos.filter((p) => p.vendasJanela > 0).length, emJogoMes, pagoAMais, vendaComLucroErrado, linhas }
}

export interface RelatorioEstoque {
  geral: BlocoRelatorio
  setores: Record<SetorRelatorio, BlocoRelatorio>
}

export const montarRelatorioEstoque = ({ produtos, setorDe, historico, janelaDias }: {
  produtos: ProductAnalyticsRow[]
  setorDe: (codigo: number) => SetorEstoque
  historico: Map<number, UltimaCompra[]>
  janelaDias: number
}): RelatorioEstoque => {
  const loja = produtos.filter((r) => setorDe(r.produtoCodigo) !== 'combustivel')
  return {
    geral: montarBloco(loja, historico, janelaDias),
    setores: {
      automotivos: montarBloco(loja.filter((r) => setorDe(r.produtoCodigo) === 'automotivos'), historico, janelaDias),
      conveniencia: montarBloco(loja.filter((r) => setorDe(r.produtoCodigo) === 'conveniencia'), historico, janelaDias),
    },
  }
}
