/**
 * DEBUG TEMPORÁRIO — diagnóstico da divergência app×BI em Automotivos.
 *
 * Uso (console do navegador, logado e com a rede conectada):
 *   1. Selecione o período no app (ex.: Maio/2026).
 *   2. Rode:  await debugAutomotivos('ITAPOA')
 *
 * Busca os itens de venda (VENDA_ITEM) do posto no período, classifica em
 * Automotivos, cruza com /VENDA (situacao='A') e imprime:
 *   - resumo por grupo (só autorizados = o que o app conta);
 *   - detalhe linha a linha dos grupos-alvo (Lubrificantes / Filtro de Óleo);
 *   - destaques: linhas NÃO autorizadas e linhas com totalVenda<=0 (cortesia?).
 *
 * REMOVER depois do diagnóstico (este arquivo + o import em main.tsx).
 */
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens, fetchVendaCodigosAutorizados } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { classifySetor } from '@/lib/setorClassification'
import { useFilterStore } from '@/store/filters'

const GRUPOS_ALVO = ['LUBRIFICANTES', 'FILTRO DE OLEO', 'FILTRO DE ÓLEO']
const n2 = (v: number) => Number(v.toFixed(2))

export const debugAutomotivos = async (postoNome = 'ITAPOA') => {
  const { dataInicial, dataFinal } = useFilterStore.getState()
  console.log(`%c[debug] período ${dataInicial} → ${dataFinal} · posto ~"${postoNome}"`, 'color:#2563eb;font-weight:bold')
  if (!dataInicial || !dataFinal) {
    console.warn('[debug] selecione um período no app antes de rodar.')
    return
  }

  const empresas = (await fetchEmpresas()).resultados ?? []
  const emp = empresas.find((e) => `${e.fantasia ?? ''} ${e.razao ?? ''}`.toUpperCase().includes(postoNome.toUpperCase()))
  if (!emp) {
    console.warn(`[debug] posto "${postoNome}" não encontrado. Disponíveis:`, empresas.map((e) => e.fantasia))
    return
  }
  console.log(`[debug] empresaCodigo=${emp.codigo} (${emp.fantasia})`)

  const [produtos, grupos, itens, autorizados] = await Promise.all([
    fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    fetchAllPages((p) => fetchVendaItens({ empresaCodigo: emp.codigo, dataInicial, dataFinal, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    fetchVendaCodigosAutorizados({ empresaCodigo: emp.codigo, dataInicial, dataFinal }),
  ])
  console.log(`[debug] ${itens.length} itens de venda no período · ${autorizados.size} vendas autorizadas (situacao='A')`)

  const grupoTipo = new Map(grupos.map((g) => [g.grupoCodigo, g.tipoGrupo]))
  const grupoNome = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))
  const prodInfo = new Map(produtos.map((p) => [p.produtoCodigo, {
    nome: p.nome,
    grupo: grupoNome.get(p.grupoCodigo) ?? '(sem grupo)',
    setor: classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)),
  }]))

  const linhas = itens
    .filter((it) => prodInfo.get(it.produtoCodigo)?.setor === 'automotivos')
    .map((it) => {
      const info = prodInfo.get(it.produtoCodigo)
      return {
        vendaCodigo: it.vendaCodigo,
        data: (it.dataMovimento || '').slice(0, 10),
        grupo: info?.grupo ?? '',
        produto: info?.nome ?? `#${it.produtoCodigo}`,
        qtd: it.quantidade,
        precoVenda: n2(it.precoVenda ?? 0),
        totalVenda: n2(it.totalVenda ?? 0),
        totalCusto: n2(it.totalCusto ?? 0),
        autorizado: autorizados.has(it.vendaCodigo),
        cancelada: it.cancelada ?? '(ausente)',
      }
    })

  // Resumo por grupo (só autorizados = o que o app conta na Central/Vendas).
  const porGrupo = new Map<string, { qtd: number; fat: number; lucro: number; n: number }>()
  for (const l of linhas) {
    if (!l.autorizado) continue
    const g = porGrupo.get(l.grupo) ?? { qtd: 0, fat: 0, lucro: 0, n: 0 }
    g.qtd += l.qtd; g.fat += l.totalVenda; g.lucro += l.totalVenda - l.totalCusto; g.n++
    porGrupo.set(l.grupo, g)
  }
  console.log('%c[debug] RESUMO por grupo (autorizados) — compare com o BI:', 'color:#059669;font-weight:bold')
  console.table([...porGrupo.entries()]
    .map(([grupo, v]) => ({ grupo, qtd: n2(v.qtd), faturamento: n2(v.fat), lucro: n2(v.lucro), linhas: v.n }))
    .sort((a, b) => b.faturamento - a.faturamento))

  // Detalhe linha a linha dos grupos-alvo.
  const alvo = linhas
    .filter((l) => GRUPOS_ALVO.some((g) => (l.grupo || '').toUpperCase().includes(g)))
    .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.data.localeCompare(b.data))
  console.log(`%c[debug] LINHAS dos grupos-alvo (${alvo.length}):`, 'color:#d97706;font-weight:bold')
  console.table(alvo)

  const naoAut = alvo.filter((l) => !l.autorizado)
  const zerados = alvo.filter((l) => l.autorizado && l.totalVenda <= 0)
  if (naoAut.length) {
    console.warn(`[debug] ${naoAut.length} linha(s) NÃO autorizadas (situacao≠'A') — o app já exclui, o BI também:`)
    console.table(naoAut)
  }
  if (zerados.length) {
    console.warn(`[debug] ${zerados.length} linha(s) autorizadas com totalVenda<=0 (bonificação/cortesia? — o BI pode excluir):`)
    console.table(zerados)
  }
  console.log('%c[debug] fim. Copie as tabelas e me mande.', 'color:#2563eb')
  return { empresaCodigo: emp.codigo, linhas, alvo }
}

export default debugAutomotivos
