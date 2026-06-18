import { useMemo, useState } from 'react'
import { Search, HelpCircle, Repeat } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
  janelaDias: number
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)
const fmtGiro = (v: number) => v.toFixed(2)
const fmtData = (iso: string | null): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

const buildColumns = (janelaDias: number): Column<ProductAnalyticsRow>[] => [
  { key: 'codigoSku', label: 'Ref.', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigoSku || '—'}</span> },
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500 dark:text-gray-400">{r.categoria}</span> },
  { key: 'codigoBarras', label: 'Cód. Barras', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigoBarras || '—'}</span> },
  { key: 'vendasJanela', label: `Vendas ${janelaDias}d`, align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.vendasJanela)}</span> },
  { key: 'estoqueMedioJanela', label: 'Estoque médio', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.estoqueMedioJanela)}</span> },
  {
    key: 'giroJanela', label: `Giro (${janelaDias}d)`, align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.giroJanela} min={0} max={2} formatted={r.giroJanela > 0 ? fmtGiro(r.giroJanela) + 'x' : '—'} />,
  },
  { key: 'saldoAtual', label: 'Saldo atual', align: 'right', sortable: true, render: (r) => <span className={cn('tabular-nums', r.saldoAtual <= 0 && 'text-red-600 dark:text-red-400')}>{fmtUnidades(r.saldoAtual)}</span> },
  { key: 'valorEstoque', label: 'Valor em estoque', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.valorEstoque)}</span> },
  { key: 'ultimaVenda', label: 'Últ. venda', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtData(r.ultimaVenda)}</span> },
]

const GiroProdutos = ({ data, categorias, janelaDias }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const columns = useMemo(() => buildColumns(janelaDias), [janelaDias])

  const filtered = useMemo(() => {
    return data
      .filter((r) => {
        if (categoria && r.categoria !== categoria) return false
        if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase()) && !r.codigoSku.toLowerCase().includes(busca.toLowerCase()) && !(r.codigoBarras ?? '').includes(busca)) return false
        return true
      })
      .sort((a, b) => b.giroJanela - a.giroJanela)
  }, [data, busca, categoria])

  const totals = useMemo(() => {
    const comGiro = filtered.filter((r) => r.giroJanela > 0)
    const giroMedio = comGiro.length > 0 ? comGiro.reduce((s, r) => s + r.giroJanela, 0) / comGiro.length : 0
    return { giroMedio, comGiro: comGiro.length, semGiro: filtered.length - comGiro.length }
  }, [filtered])

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={Repeat}
        iconColor="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-900/40"
        title="Giro dos produtos"
        titleHint={`Quantas vezes o estoque girou nos últimos ${janelaDias} dias (vendas ÷ estoque médio). Giro alto = produto rodando; giro baixo = capital parado. Veja a tabela de faixas no botão 'O que é giro'.`}
        subtitle={`${filtered.length} de ${data.length} produtos`}
        accentGradient="bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
        metrics={[
          { label: 'Produtos com giro', value: String(totals.comGiro) },
          { label: 'Sem movimento', value: String(totals.semGiro) },
          { label: 'Giro médio', value: `${fmtGiro(totals.giroMedio)}x`, color: 'text-blue-600 dark:text-blue-400' },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto, Ref. ou cód. barras..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">Todas categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              showHelp
                ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400',
            )}
          >
            <HelpCircle className="h-3.5 w-3.5" />O que é giro
          </button>
        </div>

        {showHelp && (
          <div className="border-b border-blue-200 bg-blue-50/60 px-6 py-4 dark:border-blue-800/40 dark:bg-blue-900/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">O que é giro de estoque</p>
            <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Giro</span> mede quantas vezes o estoque inteiro de um produto saiu (e foi reposto) num período. Giro alto = produto rodando; giro baixo = capital parado na prateleira.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Fórmula:</span>{' '}
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-900 dark:text-gray-300">Giro = Quantidade vendida ÷ Estoque médio</span>
            </p>
            <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">Como interpretar (em {janelaDias} dias)</p>
            <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white text-xs dark:border-blue-800/40 dark:bg-gray-900">
              <table className="w-full">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr><th className="px-3 py-2 text-left">Faixa</th><th className="px-3 py-2 text-left">Significado</th><th className="px-3 py-2 text-left">Ação sugerida</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-700 dark:text-gray-300">
                  <tr><td className="px-3 py-2 font-semibold text-green-700 dark:text-green-400">&gt; 4x</td><td className="px-3 py-2">Produto-estrela, gira rápido</td><td className="px-3 py-2">Não deixar faltar — risco de ruptura</td></tr>
                  <tr><td className="px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400">2x – 4x</td><td className="px-3 py-2">Saudável</td><td className="px-3 py-2">OK, manter</td></tr>
                  <tr><td className="px-3 py-2 font-semibold text-amber-600 dark:text-amber-400">0,5x – 2x</td><td className="px-3 py-2">Empacando</td><td className="px-3 py-2">Reduzir compra ou promover</td></tr>
                  <tr><td className="px-3 py-2 font-semibold text-red-700 dark:text-red-400">&lt; 0,5x</td><td className="px-3 py-2">Quase parado</td><td className="px-3 py-2">Considerar tirar do mix ou liquidar</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.produtoCodigo}
          enableRowHighlight
          groups={[
            { label: '', span: 4 },                        // Ref · Produto · Categoria · Cód. Barras
            { label: `Giro (${janelaDias}d)`, span: 3 },   // Vendas · Estoque médio · Giro
            { label: 'Estoque', span: 3 },                 // Saldo atual · Valor em estoque · Últ. venda
          ]}
        />

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {data.length} produtos
        </div>
      </div>
    </div>
  )
}

export default GiroProdutos
