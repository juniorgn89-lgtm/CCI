import { useEffect, useMemo, useState } from 'react'
import { useFiltrosColuna, type DefColuna } from '@/lib/filtroColuna'
import { AvisoFiltros } from '@/components/tables/FiltroColuna'
import BalaoAcao from '@/components/ui/BalaoAcao'
import { Search, Package, ShoppingCart, X, CheckCircle2, Sparkles } from 'lucide-react'
import AnaliseProdutosModal from '@/pages/Estoques/components/AnaliseProdutosModal'
import { Link } from 'react-router-dom'
import { useFilterStore } from '@/store/filters'
import useVisivel from '@/hooks/useVisivel'
import GerarPedidoEstoque from '@/pages/Estoques/components/GerarPedidoEstoque'
import useUltimaCompra, { ULTIMA_COMPRA_DIAS, type UltimaCompra } from '@/pages/Estoques/hooks/useUltimaCompra'
import { variacaoUltimaCompra, faixaVariacao } from '@/pages/Estoques/lib/analiseProdutos'
import { formatCurrency } from '@/lib/formatters'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import ProdutoDetalheModal from '@/pages/Estoques/components/ProdutoDetalheModal'
import { fmtUnidades, fmtDataBR, casaBusca, casaSituacao, SITUACOES, type SituacaoProduto as Situacao } from '@/pages/Estoques/components/estoqueComum'
import { SETOR_ESTOQUE_LABEL, type SetorEstoque } from '@/pages/Estoques/hooks/useSetorProduto'
import type { AbrirProdutos } from '@/pages/Estoques/components/abas/EstoqueVisaoGeral'
import { todayLocal } from '@/lib/period'

interface Selecao { ativo: boolean; marcados: Set<number>; alternar: (c: number) => void }
const caixaCls = 'h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#0d9488] dark:border-[#3e4c63]'
const colunaCaixa = (sel: Selecao): Column<ProductAnalyticsRow> => ({
  key: '_sel', label: '', className: 'w-10',
  render: (r) => (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <input type="checkbox" className={caixaCls} aria-label={`Selecionar ${r.produtoNome}`} checked={sel.marcados.has(r.produtoCodigo)} onChange={() => sel.alternar(r.produtoCodigo)} />
    </span>
  ),
})

const COR_FAIXA = { alta: 'text-red-600 dark:text-[#e3a3a3]', subiu: 'text-amber-600 dark:text-amber-300', caiu: 'text-sky-700 dark:text-[#9db5d6]', normal: 'text-gray-800 dark:text-gray-100' } as const

const buildColumns = (janelaDias: number, sel: Selecao, ultima: Map<number, UltimaCompra>, historico: Map<number, UltimaCompra[]>): Column<ProductAnalyticsRow>[] => [
  ...(sel.ativo ? [colunaCaixa(sel)] : []),
  {
    key: 'produtoNome', label: 'Produto', sortable: true,
    help: 'Nome do produto no cadastro do ERP. Embaixo: a referência interna (Ref.) e o código de barras. Clique na linha para ver o detalhe.',
    render: (r) => (
      <span>
        <span className="block font-medium">{r.produtoNome}</span>
        <span className="block font-mono text-[10.5px] text-gray-400">{[r.codigoSku && `Ref. ${r.codigoSku}`, r.codigoBarras].filter(Boolean).join(' · ') || '—'}</span>
      </span>
    ),
  },
  { key: 'categoria', label: 'Categoria', sortable: true, help: 'Grupo do produto no cadastro do ERP (ex.: Cervejas, Lubrificantes).', render: (r) => <span className="text-xs text-gray-500 dark:text-gray-400">{r.categoria}</span> },
  {
    key: 'saldoAtual', label: 'Saldo', align: 'right', sortable: true,
    help: 'Quantidade em estoque agora, segundo o ERP. Vermelho: zerado ou negativo (vendeu sem nota de entrada lançada). Âmbar: abaixo do mínimo cadastrado.',
    render: (r) => <span className={cn('tabular-nums font-semibold', r.saldoAtual < 0 ? 'text-red-700 dark:text-red-300' : r.saldoAtual === 0 ? 'text-red-600 dark:text-red-400' : r.estoqueMinimo > 0 && r.saldoAtual < r.estoqueMinimo ? 'text-amber-600 dark:text-amber-400' : '')}>{fmtUnidades(r.saldoAtual)}</span>,
  },
  { key: 'estoqueMinimo', label: 'Mínimo', align: 'right', sortable: true, help: 'Estoque mínimo cadastrado no ERP para o produto. — = sem mínimo cadastrado.', render: (r) => <span className="tabular-nums text-gray-500">{r.estoqueMinimo > 0 ? fmtUnidades(r.estoqueMinimo) : '—'}</span> },
  {
    key: '_ultimaCompra', label: 'Custo últ. compra', align: 'right', sortable: true,
    help: `Custo unitário na última nota de entrada do produto neste posto (últimos ${ULTIMA_COMPRA_DIAS} dias), com a data. Vermelho com ▲: 20% ou mais acima do normal (mediana das compras anteriores do ano); âmbar: subiu de 5% a 20%; azul com ▼: 20% ou mais abaixo. Sem nota no período: —.`,
    render: (r) => {
      const u = ultima.get(r.produtoCodigo)
      if (!u) return <span className="text-gray-400">—</span>
      const vc = variacaoUltimaCompra(historico.get(r.produtoCodigo))
      const faixa = vc ? faixaVariacao(vc.varia) : 'normal'
      const pct = vc ? Math.abs(vc.varia * 100).toFixed(0) : ''
      const celula = (
        <span className="inline-flex flex-col items-end leading-tight">
          <span className={cn('font-semibold tabular-nums', COR_FAIXA[faixa])}>{formatCurrency(u.custo)}</span>
          {faixa !== 'normal' && vc
            ? <span className={cn('text-[10.5px] font-semibold', COR_FAIXA[faixa])}>{vc.varia > 0 ? '▲' : '▼'} {pct}% {vc.varia > 0 ? 'acima' : 'abaixo'} do normal</span>
            : null}
          <span className="text-[10.5px] tabular-nums text-gray-400">nota de {fmtDataBR(u.data)}</span>
        </span>
      )
      if (faixa === 'normal' || !vc) return celula
      // Balão ao parar o mouse: a conta inteira, em português de dono.
      return (
        <BalaoAcao atraso={300} lado="left" texto={<>Esta nota custou <b>{formatCurrency(u.custo)}</b>, {pct}% {vc.varia > 0 ? 'acima' : 'abaixo'} do normal deste produto (<b>{formatCurrency(vc.normal)}</b>, o meio das compras anteriores do ano). {vc.varia > 0 ? 'Confira a nota e, se o aumento for real, veja se o preço de venda acompanhou.' : 'Confira a nota: pode ser erro de digitação ou de unidade.'}</>}>
          {celula}
        </BalaoAcao>
      )
    },
  },
  { key: 'valorEstoque', label: 'Valor em estoque', align: 'right', sortable: true, help: 'Saldo × custo unitário (o do cadastro; sem ele, o custo médio das vendas). Quanto dinheiro está parado neste produto.', render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(r.valorEstoque)}</span> },
  { key: 'vendasJanela', label: `Vendido ${janelaDias}d`, align: 'right', sortable: true, help: `Quantidade vendida nos últimos ${janelaDias} dias.`, render: (r) => <span className="tabular-nums">{r.vendasJanela > 0 ? fmtUnidades(r.vendasJanela) : '—'}</span> },
  { key: 'mediaDiariaVendas', label: 'Média/dia', align: 'right', sortable: true, help: 'Média vendida por dia na janela de cálculo.', render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{r.mediaDiariaVendas > 0 ? fmtUnidades(r.mediaDiariaVendas) : '—'}</span> },
  {
    key: 'giroJanela', label: 'Giro', align: 'right', sortable: true,
    help: 'Vendido ÷ estoque médio na janela. Acima de 2x o produto roda bem; abaixo de 0,5x está quase parado (dinheiro empatado).',
    render: (r) => <HeatmapCell value={r.giroJanela} min={0} max={2} formatted={r.giroJanela > 0 ? `${r.giroJanela.toFixed(2)}x` : '—'} />,
  },
  { key: 'ultimaVenda', label: 'Última venda', align: 'right', sortable: true, help: 'Data da venda mais recente do produto neste posto.', render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtDataBR(r.ultimaVenda)}</span> },
]

/**
 * Produtos do posto numa lista só (antes: Estoque geral + Giro + Média de
 * venda, a mesma lista em 3 abas). Estoque e venda lado a lado; preço do
 * cadastro, mês de pico e o mês a mês ficam no detalhe (clique na linha).
 */
const ProdutosEstoque = ({ data, categorias, janelaDias, coberturaDias, setorDe, filtroInicial }: {
  data: ProductAnalyticsRow[]
  categorias: string[]
  janelaDias: number
  coberturaDias: number
  setorDe: (codigo: number) => SetorEstoque
  /** Vindo de um bloco da Visão Geral: abre já filtrado igual. */
  filtroInicial?: AbrirProdutos | null
}) => {
  const hoje = todayLocal()
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<Situacao>(filtroInicial?.situacao ?? 'todos')
  const [setor, setSetor] = useState<SetorEstoque | ''>(filtroInicial?.setor ?? '')
  // Guarda só o código: o detalhe lê a linha ATUAL (não congela dado em carregamento).
  const [abertoCodigo, setAbertoCodigo] = useState<number | null>(null)
  const aberto = abertoCodigo == null ? null : data.find((r) => r.produtoCodigo === abertoCodigo) ?? null
  // Pedido de compra direto daqui (rede com Compras à vista): caixinhas + botão no detalhe.
  const comprasVisivel = useVisivel().modulo('/compras')
  const empresaCodigo = useFilterStore((st) => (st.empresaCodigos.length === 1 ? st.empresaCodigos[0] : null))
  const podePedir = comprasVisivel && empresaCodigo != null
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set())
  const alternar = (c: number) => setMarcados((m) => { const n = new Set(m); if (n.has(c)) n.delete(c); else n.add(c); return n })
  const [pedidoDe, setPedidoDe] = useState<ProductAnalyticsRow[] | null>(null)
  const [pedidoOk, setPedidoOk] = useState(false)
  const empresaUltima = useFilterStore((st) => (st.empresaCodigos.length === 1 ? st.empresaCodigos[0] : null))
  const { porProduto: ultimaCompra, historico: historicoCompras, carregando: carregandoCompras } = useUltimaCompra(empresaUltima)
  const [analise, setAnalise] = useState(false)
  const [daAnalise, setDaAnalise] = useState(false)
  const columns = buildColumns(janelaDias, { ativo: podePedir, marcados, alternar }, ultimaCompra, historicoCompras)

  const base = useMemo(() => data
    .filter((r) => (!setor || setorDe(r.produtoCodigo) === setor) && casaBusca(r, busca) && casaSituacao(r, situacao, coberturaDias, hoje))
    .sort((a, b) => b.valorEstoque - a.valorEstoque), [data, busca, situacao, setor, setorDe, coberturaDias, hoje])
  // Custo da última compra vira campo da linha para a coluna poder ordenar (sem nota = vai para o fim).
  const linhasBase = useMemo(() => base.map((r) => ({ ...r, _ultimaCompra: ultimaCompra.get(r.produtoCodigo)?.custo ?? null })), [base, ultimaCompra])

  // Filtro estilo Excel em todas as colunas: o valor como aparece na tela; a ordem, pelo número.
  type Linha = (typeof linhasBase)[number]
  const num = (v: number) => String(Math.round(v * 1000) + 1e12).padStart(16, '0')
  const COLS = useMemo<Record<string, DefColuna<Linha>>>(() => ({
    produtoNome: (r) => r.produtoNome,
    categoria: (r) => r.categoria,
    saldoAtual: { valor: (r) => fmtUnidades(r.saldoAtual), ordem: (r) => num(r.saldoAtual) },
    estoqueMinimo: { valor: (r) => (r.estoqueMinimo > 0 ? fmtUnidades(r.estoqueMinimo) : 'sem mínimo'), ordem: (r) => num(r.estoqueMinimo) },
    _ultimaCompra: { valor: (r) => (r._ultimaCompra != null ? formatCurrency(r._ultimaCompra) : 'sem nota'), ordem: (r) => num(r._ultimaCompra ?? -1) },
    valorEstoque: { valor: (r) => formatCurrencyInt(r.valorEstoque), ordem: (r) => num(r.valorEstoque) },
    vendasJanela: { valor: (r) => (r.vendasJanela > 0 ? fmtUnidades(r.vendasJanela) : 'sem venda'), ordem: (r) => num(r.vendasJanela) },
    mediaDiariaVendas: { valor: (r) => (r.mediaDiariaVendas > 0 ? fmtUnidades(r.mediaDiariaVendas) : 'sem venda'), ordem: (r) => num(r.mediaDiariaVendas) },
    giroJanela: { valor: (r) => (r.giroJanela >= 2 ? 'Roda bem (2x ou mais)' : r.giroJanela >= 0.5 ? 'Normal (0,5x a 2x)' : r.giroJanela > 0 ? 'Quase parado (abaixo de 0,5x)' : 'Sem giro'), ordem: (r) => num(-r.giroJanela) },
    ultimaVenda: { valor: (r) => fmtDataBR(r.ultimaVenda), ordem: (r) => String(r.ultimaVenda ?? '') },
  }), [])
  const fc = useFiltrosColuna(linhasBase, COLS)
  const linhas = fc.filtradas
  const filtered = linhas
  // Vindo de um bloco da Visão Geral com categoria: abre com o funil da Categoria já marcado.
  useEffect(() => {
    if (filtroInicial?.categoria) fc.de('categoria').aplicar(new Set([filtroInicial.categoria]))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [])

  const totais = useMemo(() => ({
    valor: filtered.reduce((s, r) => s + r.valorEstoque, 0),
    unidades: filtered.reduce((s, r) => s + Math.max(0, r.saldoAtual), 0),
    vendido: filtered.reduce((s, r) => s + r.vendasJanela, 0),
    semMov: filtered.filter((r) => r.vendasJanela === 0).length,
  }), [filtered])

  const filtrando = busca.trim() !== '' || situacao !== 'todos' || setor !== '' || fc.qtdAtivos > 0
  const limparTudo = () => { setBusca(''); setSituacao('todos'); setSetor(''); fc.limpar() }

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={Package}
        iconColor="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-900/40"
        title="Produtos do posto"
        titleHint={`Estoque e venda de cada produto. Vendido, média por dia e giro usam os últimos ${janelaDias} dias. Giro = vendido ÷ estoque médio: acima de 2x o produto roda bem; abaixo de 0,5x está quase parado (capital empatado). Clique num produto para ver preço, margem e as vendas mês a mês.`}
        subtitle={`${filtered.length} de ${data.length} produtos`}
        accentGradient="bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
        metrics={[
          { label: 'Valor em estoque', value: formatCurrencyInt(totais.valor), color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Unidades em estoque', value: fmtUnidades(totais.unidades) },
          { label: `Vendido ${janelaDias}d`, value: fmtUnidades(totais.vendido) },
          { label: 'Sem movimento', value: String(totais.semMov) },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="relative min-w-[220px] max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar produto, Ref. ou cód. barras…" value={busca} onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-[#1e3a5f] focus:outline-none dark:border-gray-600 dark:bg-[#0f172a] dark:text-gray-100 dark:placeholder:text-gray-500" />
          </div>
          {/* Setor em pílulas (antes: caixa de seleção) */}
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-white/[0.05]" role="group" aria-label="Setor">
            {([['', 'Todos'], ...(Object.keys(SETOR_ESTOQUE_LABEL) as SetorEstoque[]).map((k) => [k, SETOR_ESTOQUE_LABEL[k]])] as [SetorEstoque | '', string][]).map(([k, rot]) => (
              <button key={k || 'todos'} type="button" onClick={() => setSetor(k)}
                className={cn('h-8 rounded-md px-2.5 text-[12px] font-semibold transition-colors', setor === k ? 'bg-white text-gray-900 shadow-sm dark:bg-teal-600 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white')}>{rot}</button>
            ))}
          </span>
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao)} aria-label="Situação"
            className={cn('h-9 rounded-lg border px-2.5 text-[12.5px] focus:outline-none', situacao !== 'todos' ? 'border-[#1e3a5f] bg-[#1e3a5f]/[0.06] font-semibold text-[#1e3a5f] dark:border-teal-500 dark:bg-teal-500/10 dark:text-teal-200' : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-[#0f172a] dark:text-gray-300')}>
            {SITUACOES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
          </select>
          <AvisoFiltros qtd={fc.qtdAtivos} onLimpar={fc.limpar} />
          {filtrando && <button type="button" onClick={limparTudo} className="text-[12px] font-semibold text-[#2563eb] hover:underline dark:text-blue-300">Limpar tudo</button>}
          <button type="button" onClick={() => setAnalise(true)}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-[12.5px] font-semibold text-teal-800 hover:bg-teal-100 dark:border-[#0d9488]/40 dark:bg-[#0d9488]/[0.10] dark:text-[#5eead4] dark:hover:bg-[#0d9488]/[0.18]">
            <Sparkles className="h-4 w-4" /> Analisar produtos
          </button>
        </div>

        {podePedir && (marcados.size > 0 || pedidoOk) && (
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-teal-50/60 px-6 py-2.5 dark:border-gray-700 dark:bg-[#0d9488]/[0.08]">
            {marcados.size > 0 ? (
              <>
                <span className="text-[13px] text-gray-700 dark:text-[#e2e8f0]"><b className="font-semibold">{marcados.size} {marcados.size === 1 ? 'produto selecionado' : 'produtos selecionados'}</b></span>
                <button type="button" onClick={() => setMarcados(new Set(filtered.map((r) => r.produtoCodigo)))} className="text-[12px] font-semibold text-teal-700 hover:underline dark:text-[#5eead4]">Marcar os {filtered.length} da lista</button>
                <button type="button" onClick={() => setMarcados(new Set())} className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-800 dark:text-[#94a3b8] dark:hover:text-white"><X className="h-3.5 w-3.5" /> Limpar</button>
                <button type="button" onClick={() => { setPedidoOk(false); setPedidoDe(data.filter((r) => marcados.has(r.produtoCodigo))) }}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[12.5px] font-semibold text-white hover:bg-teal-700">
                  <ShoppingCart className="h-4 w-4" /> Gerar pedido de compra
                </button>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-800 dark:text-[#86c5aa]"><CheckCircle2 className="h-4 w-4" /> Pedido criado. Ele está em Compras › Pedidos, aguardando liberação.</span>
                <Link to="/compras?tab=pedidos" className="ml-auto text-[12.5px] font-semibold text-teal-700 hover:underline dark:text-[#5eead4]">Ver o pedido</Link>
                <button type="button" onClick={() => setPedidoOk(false)} aria-label="Fechar aviso" className="rounded p-0.5 text-gray-500 hover:bg-black/5 dark:hover:bg-white/5"><X className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        )}

        <DataTable
          columns={columns}
          data={linhas}
          keyExtractor={(r) => r.produtoCodigo}
          filtroDe={(k) => (k in COLS ? fc.de(k) : null)}
          enableRowHighlight
          onRowClick={(r) => setAbertoCodigo(r.produtoCodigo)}
          groups={[
            { label: '', span: podePedir ? 3 : 2 },           // (caixinha) · Produto · Categoria
            { label: 'Estoque', span: 4 },                  // Saldo · Mínimo · Custo últ. compra · Valor
            { label: `Venda (${janelaDias}d)`, span: 4 },   // Vendido · Média/dia · Giro · Última venda
          ]}
        />

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {data.length} produtos · clique num produto para o detalhe
        </div>
      </div>

      <AnaliseProdutosModal open={analise} onClose={() => setAnalise(false)} data={data} categorias={categorias} setorDe={setorDe}
        historico={historicoCompras} carregandoCompras={carregandoCompras}
        janelaDias={janelaDias}
        onAbrirProduto={(cod) => { setAnalise(false); setDaAnalise(true); setAbertoCodigo(cod) }} />
      <ProdutoDetalheModal produto={aberto} janelaDias={janelaDias} coberturaDias={coberturaDias}
        compras={aberto && empresaUltima != null ? (historicoCompras.get(aberto.produtoCodigo) ?? []) : undefined} onClose={() => { setAbertoCodigo(null); setDaAnalise(false) }}
        onVoltar={daAnalise ? () => { setAbertoCodigo(null); setDaAnalise(false); setAnalise(true) } : undefined}
        onGerarPedido={podePedir && aberto ? () => { setAbertoCodigo(null); setPedidoOk(false); setPedidoDe([aberto]) } : undefined} />
      {podePedir && pedidoDe && pedidoDe.length > 0 && (
        <GerarPedidoEstoque empresaCodigo={empresaCodigo!} produtos={pedidoDe} coberturaDias={coberturaDias}
          onClose={() => setPedidoDe(null)}
          onSalvo={() => { setPedidoDe(null); setMarcados(new Set()); setPedidoOk(true) }} />
      )}
    </div>
  )
}

export default ProdutosEstoque
