import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import type { TarefaInicial } from '@/pages/Gestao/Tarefas'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { custoUnit, precoUnit, ehTravado, DIAS_ENCALHANDO } from '@/pages/Estoques/components/estoqueComum'

/** Desconto máximo sugerido sobre o preço atual. */
export const DESCONTO_MAX = 0.15
/** O preço novo fica pelo menos isso acima do maior custo (vender a preço de custo não dá lucro). */
export const MARGEM_MIN = 0.05
const MAX_ETAPAS = 40

export interface PrecoSugerido {
  atual: number
  /** null = sem espaço para baixar (ou sem preço no cadastro). */
  sugerido: number | null
  /** Maior custo conhecido: o do cadastro ou o da última compra. */
  piso: number
}

/** Termina em ",90" quando cabe entre o piso e o alvo (ex.: 52,90). */
const precoDeVitrine = (alvo: number, piso: number) => {
  let c = Math.floor(alvo) + 0.9
  if (c > alvo) c -= 1
  return c >= piso ? Math.round(c * 100) / 100 : Math.ceil(alvo * 100) / 100
}

/**
 * Preço novo sugerido: até 15% abaixo do atual, sempre pelo menos 5% acima do MAIOR custo
 * (cadastro ou última compra — se a última nota veio mais cara, baixar pelo
 * custo antigo faria vender abaixo do que custa repor).
 */
export const sugerirPreco = (r: ProductAnalyticsRow, custoUltimaCompra: number | null): PrecoSugerido => {
  const atual = precoUnit(r)
  const piso = Math.max(custoUnit(r), custoUltimaCompra ?? 0)
  if (atual <= 0) return { atual, sugerido: null, piso }
  const minimo = piso * (1 + MARGEM_MIN)
  const alvo = Math.max(atual * (1 - DESCONTO_MAX), minimo)
  const sugerido = precoDeVitrine(alvo, minimo)
  // Menos de 2% de diferença não é desconto que mova o cliente.
  return { atual, sugerido: sugerido < atual * 0.98 ? sugerido : null, piso }
}

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const emDias = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Etapa da tarefa para um produto: o que fazer, com os números para quem vai mexer no ERP. */
const etapaDe = (r: ProductAnalyticsRow, p: PrecoSugerido) => {
  const ref = r.codigoSku ? `Ref. ${r.codigoSku} · ` : ''
  const parado = `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(r.saldoAtual)} un. no estoque`
  if (p.atual <= 0) return `${ref}${r.produtoNome} · sem preço de venda no cadastro: conferir o preço`
  if (p.sugerido == null) {
    return `${ref}${r.produtoNome} · ${formatCurrency(p.atual)} · sem margem para baixar (custo ${formatCurrency(p.piso)}): avaliar kit ou devolução ao fornecedor`
  }
  const pct = Math.round((1 - p.sugerido / p.atual) * 100)
  return `${ref}${r.produtoNome} · de ${formatCurrency(p.atual)} para ${formatCurrency(p.sugerido)} (−${pct}%) · custo ${formatCurrency(p.piso)} · ${parado}`
}

/** Monta a tarefa "baixar o preço" a partir dos produtos marcados na aba Produtos. */
export const montarTarefaPreco = ({ itens, ultimaCompra, empresaCodigo, posto, setorNome }: {
  itens: ProductAnalyticsRow[]
  ultimaCompra: (codigo: number) => number | null
  empresaCodigo: number
  posto: string
  /** "Automotivos", "Conveniência"… (null = setores misturados). */
  setorNome: string | null
}): TarefaInicial => {
  const h = hoje()
  const todosTravados = itens.every((r) => ehTravado(r, h))
  const n = itens.length
  const precos = itens.map((r) => ({ r, p: sugerirPreco(r, ultimaCompra(r.produtoCodigo)) }))
  const dinheiro = itens.reduce((s, r) => s + Math.max(0, r.saldoAtual) * custoUnit(r), 0)
  const comPreco = precos.filter((x) => x.p.sugerido != null).length
  const qtd = `${n} produto${n > 1 ? 's' : ''}${todosTravados ? (n > 1 ? ' parados' : ' parado') : ''}`
  const titulo = `Baixar o preço de ${qtd}${setorNome ? ` (${setorNome})` : ''} · ${posto}`

  const descricao = [
    todosTravados
      ? `Análise do Visor: estes produtos estão parados (sem venda há mais de 90 dias) ou com estoque para mais de ${DIAS_ENCALHANDO} dias.`
      : 'Análise do Visor: produtos selecionados no Estoques para baixar o preço e girar o estoque.',
    `São ${formatCurrencyInt(dinheiro)} de dinheiro parado na prateleira. Vender ajuda o lucro do mês e devolve o dinheiro ao caixa.`,
    `Preço sugerido: até ${Math.round(DESCONTO_MAX * 100)}% abaixo do atual, sempre pelo menos ${Math.round(MARGEM_MIN * 100)}% acima do maior custo (cadastro ou última compra). ${comPreco} de ${n} ${comPreco === 1 ? 'tem' : 'têm'} espaço para baixar.`,
    n > MAX_ETAPAS ? `A lista de etapas mostra os ${MAX_ETAPAS} primeiros; os outros ${n - MAX_ETAPAS} estão no Estoques.` : null,
    'Altere o preço no sistema (ERP), marque cada produto e anexe o print do preço novo. O Visor só lê o ERP.',
  ].filter(Boolean).join('\n')

  return {
    titulo,
    descricao,
    empresaCodigo,
    prioridade: 'alta',
    checklist: precos.slice(0, MAX_ETAPAS).map(({ r, p }) => ({ texto: etapaDe(r, p), feito: false })),
    data: emDias(2),
    hora: '18:00',
    documentos: ['Print do preço novo no sistema'],
  }
}

/** Um kit escolhido na tela "Como fechar o mês ainda melhor?" (formato mínimo para a tarefa). */
export interface KitParaTarefa {
  travado: ProductAnalyticsRow
  parceiro: ProductAnalyticsRow
  precoKit: number
  desconto: number
  comprovado: boolean
}

const refNome = (r: ProductAnalyticsRow) => `${r.codigoSku ? `Ref. ${r.codigoSku} ` : ''}${r.produtoNome}`

/**
 * Tarefa a partir da tela de destravar estoque: kits marcados (cadastrar e expor)
 * e produtos marcados (baixar o preço, mesma regra do Estoques).
 */
export const montarTarefaDestravar = ({ kits, produtos, ultimaCompra, empresaCodigo, posto, setorNome }: {
  kits: KitParaTarefa[]
  produtos: ProductAnalyticsRow[]
  ultimaCompra: (codigo: number) => number | null
  empresaCodigo: number
  posto: string
  setorNome: string
}): TarefaInicial => {
  const nk = kits.length
  const np = produtos.length
  const partes = [nk ? `montar ${nk} kit${nk > 1 ? 's' : ''}` : null, np ? `baixar o preço de ${np} produto${np > 1 ? 's' : ''}` : null].filter(Boolean)
  const acao = partes.join(' e ')
  const titulo = `${acao.charAt(0).toUpperCase()}${acao.slice(1)} (${setorNome}) · ${posto}`

  const etapasKit = kits.map((k) => ({
    texto: `Kit: ${refNome(k.travado)} + ${refNome(k.parceiro)} · kit por ${formatCurrency(k.precoKit)}${k.desconto > 0 ? ` (${formatCurrency(k.desconto)} de desconto no parado)` : ''} · cadastrar no ERP e expor no caixa e na pista`,
    feito: false,
  }))
  const etapasPreco = produtos.map((r) => ({ texto: etapaDe(r, sugerirPreco(r, ultimaCompra(r.produtoCodigo))), feito: false }))
  const etapas = [...etapasKit, ...etapasPreco]

  const travadosUnicos = new Map<number, ProductAnalyticsRow>()
  for (const k of kits) travadosUnicos.set(k.travado.produtoCodigo, k.travado)
  for (const r of produtos) travadosUnicos.set(r.produtoCodigo, r)
  const dinheiro = [...travadosUnicos.values()].reduce((s, r) => s + Math.max(0, r.saldoAtual) * custoUnit(r), 0)
  const sugestoes = kits.filter((k) => !k.comprovado).length

  const descricao = [
    `Análise do Visor (Como fechar o mês ainda melhor?): produtos de ${setorNome.toLowerCase()} parados (sem venda há mais de 90 dias) ou com estoque para mais de ${DIAS_ENCALHANDO} dias.`,
    `São ${formatCurrencyInt(dinheiro)} de dinheiro parado na prateleira. Vender ajuda o lucro do mês e devolve o dinheiro ao caixa.`,
    nk ? `Kits: o desconto vai só no produto parado e o kit mantém lucro.${sugestoes ? ` ${sugestoes} ${sugestoes === 1 ? 'é sugestão' : 'são sugestões'} (sem cupom que comprove que saem juntos): teste e veja se vende.` : ''}` : null,
    np ? `Preço: até ${Math.round(DESCONTO_MAX * 100)}% abaixo do atual, sempre pelo menos ${Math.round(MARGEM_MIN * 100)}% acima do maior custo (cadastro ou última compra).` : null,
    etapas.length > MAX_ETAPAS ? `A lista de etapas mostra as ${MAX_ETAPAS} primeiras; as outras ${etapas.length - MAX_ETAPAS} estão no Visor.` : null,
    'Faça no sistema (ERP), marque cada etapa e anexe o print. O Visor só lê o ERP.',
  ].filter(Boolean).join('\n')

  return {
    titulo,
    descricao,
    empresaCodigo,
    prioridade: 'alta',
    checklist: etapas.slice(0, MAX_ETAPAS),
    data: emDias(2),
    hora: '18:00',
    documentos: [nk && np ? 'Print dos kits e preços no sistema' : nk ? 'Print dos kits cadastrados no sistema' : 'Print do preço novo no sistema'],
  }
}
