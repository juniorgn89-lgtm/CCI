import { useMemo, useState } from 'react'
import { Search, Package } from 'lucide-react'
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

const buildColumns = (janelaDias: number): Column<ProductAnalyticsRow>[] => [
  {
    key: 'produtoNome', label: 'Produto', sortable: true,
    render: (r) => (
      <span>
        <span className="block font-medium">{r.produtoNome}</span>
        <span className="block font-mono text-[10.5px] text-gray-400">{[r.codigoSku && `Ref. ${r.codigoSku}`, r.codigoBarras].filter(Boolean).join(' · ') || '—'}</span>
      </span>
    ),
  },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500 dark:text-gray-400">{r.categoria}</span> },
  {
    key: 'saldoAtual', label: 'Saldo', align: 'right', sortable: true,
    render: (r) => <span className={cn('tabular-nums font-semibold', r.saldoAtual < 0 ? 'text-red-700 dark:text-red-300' : r.saldoAtual === 0 ? 'text-red-600 dark:text-red-400' : r.estoqueMinimo > 0 && r.saldoAtual < r.estoqueMinimo ? 'text-amber-600 dark:text-amber-400' : '')}>{fmtUnidades(r.saldoAtual)}</span>,
  },
  { key: 'estoqueMinimo', label: 'Mínimo', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500">{r.estoqueMinimo > 0 ? fmtUnidades(r.estoqueMinimo) : '—'}</span> },
  { key: 'valorEstoque', label: 'Valor em estoque', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(r.valorEstoque)}</span> },
  { key: 'vendasJanela', label: `Vendido ${janelaDias}d`, align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{r.vendasJanela > 0 ? fmtUnidades(r.vendasJanela) : '—'}</span> },
  { key: 'mediaDiariaVendas', label: 'Média/dia', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{r.mediaDiariaVendas > 0 ? fmtUnidades(r.mediaDiariaVendas) : '—'}</span> },
  {
    key: 'giroJanela', label: 'Giro', align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.giroJanela} min={0} max={2} formatted={r.giroJanela > 0 ? `${r.giroJanela.toFixed(2)}x` : '—'} />,
  },
  { key: 'ultimaVenda', label: 'Última venda', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtDataBR(r.ultimaVenda)}</span> },
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
  const [categoria, setCategoria] = useState(filtroInicial?.categoria ?? '')
  const [situacao, setSituacao] = useState<Situacao>(filtroInicial?.situacao ?? 'todos')
  const [setor, setSetor] = useState<SetorEstoque | ''>(filtroInicial?.setor ?? '')
  // Guarda só o código: o detalhe lê a linha ATUAL (não congela dado em carregamento).
  const [abertoCodigo, setAbertoCodigo] = useState<number | null>(null)
  const aberto = abertoCodigo == null ? null : data.find((r) => r.produtoCodigo === abertoCodigo) ?? null
  const columns = useMemo(() => buildColumns(janelaDias), [janelaDias])

  const filtered = useMemo(() => data
    .filter((r) => (!setor || setorDe(r.produtoCodigo) === setor) && (!categoria || r.categoria === categoria) && casaBusca(r, busca) && casaSituacao(r, situacao, coberturaDias, hoje))
    .sort((a, b) => b.valorEstoque - a.valorEstoque), [data, busca, categoria, situacao, setor, setorDe, coberturaDias, hoje])

  const totais = useMemo(() => ({
    valor: filtered.reduce((s, r) => s + r.valorEstoque, 0),
    unidades: filtered.reduce((s, r) => s + Math.max(0, r.saldoAtual), 0),
    vendido: filtered.reduce((s, r) => s + r.vendasJanela, 0),
    semMov: filtered.filter((r) => r.vendasJanela === 0).length,
  }), [filtered])

  const filtrando = busca.trim() !== '' || categoria !== '' || situacao !== 'todos' || setor !== ''
  const selectCls = 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-[#0f0f0f] dark:text-gray-300'

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
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar produto, Ref. ou cód. barras..." value={busca} onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-[#0f0f0f] dark:text-gray-100 dark:placeholder:text-gray-500" />
          </div>
          <select value={setor} onChange={(e) => setSetor(e.target.value as SetorEstoque | '')} className={selectCls}>
            <option value="">Todos os setores</option>
            {(Object.keys(SETOR_ESTOQUE_LABEL) as SetorEstoque[]).map((k) => <option key={k} value={k}>{SETOR_ESTOQUE_LABEL[k]}</option>)}
          </select>
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao)} className={selectCls}>
            {SITUACOES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={selectCls}>
            <option value="">Todas categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {filtrando && (
            <button type="button" onClick={() => { setBusca(''); setCategoria(''); setSituacao('todos'); setSetor('') }} className="text-xs font-semibold text-[#2563eb] hover:underline dark:text-blue-300">Limpar</button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.produtoCodigo}
          enableRowHighlight
          onRowClick={(r) => setAbertoCodigo(r.produtoCodigo)}
          groups={[
            { label: '', span: 2 },                         // Produto · Categoria
            { label: 'Estoque', span: 3 },                  // Saldo · Mínimo · Valor
            { label: `Venda (${janelaDias}d)`, span: 4 },   // Vendido · Média/dia · Giro · Última venda
          ]}
        />

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {data.length} produtos · clique num produto para o detalhe
        </div>
      </div>

      <ProdutoDetalheModal produto={aberto} janelaDias={janelaDias} coberturaDias={coberturaDias} onClose={() => setAbertoCodigo(null)} />
    </div>
  )
}

export default ProdutosEstoque
