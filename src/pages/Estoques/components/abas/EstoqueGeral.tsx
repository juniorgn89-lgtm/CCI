import { useMemo, useState } from 'react'
import { Search, Boxes } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)
const fmtPct = (v: number) => `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}%`
const fmtData = (iso: string | null): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

// Espelha o relatório "Produto" do webPosto. P. Custo / P. Venda / Markup /
// Marg. Luc. vêm do CADASTRO (/PRODUTO_ESTOQUE_EXTRATO): P. Venda = tabela A.
// A coluna "Tipo" indica a tabela de preço usada (A). Batem com o Cadastro de
// Produtos do webPosto.
const columns: Column<ProductAnalyticsRow>[] = [
  { key: 'codigoSku', label: 'Ref.', sortable: true, render: (r) => <span className="font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">{r.codigoSku || '—'}</span> },
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'codigoBarras', label: 'Cód. Barras', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigoBarras || '—'}</span> },
  { key: 'precoCustoCadastro', label: 'P. Custo', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{r.precoCustoCadastro > 0 ? formatCurrency(r.precoCustoCadastro) : '—'}</span> },
  {
    key: 'lucroBrutoPctCadastro', label: 'Lucro Bruto %', align: 'right', sortable: true,
    render: (r) => (r.precoVendaCadastro > 0
      ? <HeatmapCell value={r.lucroBrutoPctCadastro} min={0} max={100} formatted={fmtPct(r.lucroBrutoPctCadastro)} />
      : <span className="text-gray-400">—</span>),
  },
  { key: 'tipoPreco', label: 'Tipo', align: 'center', sortable: false, render: (r) => <span className="font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">{r.precoVendaCadastro > 0 ? 'A' : '—'}</span> },
  { key: 'precoVendaCadastro', label: 'P. Venda', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{r.precoVendaCadastro > 0 ? formatCurrency(r.precoVendaCadastro) : '—'}</span> },
  { key: 'margemLucroCadastro', label: 'Marg. Luc.', align: 'right', sortable: true, render: (r) => <span className="tabular-nums font-medium">{r.precoVendaCadastro > 0 ? formatCurrency(r.margemLucroCadastro) : '—'}</span> },
  { key: 'estoqueMinimo', label: 'Qtd. Mín.', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{r.estoqueMinimo > 0 ? fmtUnidades(r.estoqueMinimo) : '—'}</span> },
  {
    key: 'saldoAtual', label: 'Qtd', align: 'right', sortable: true,
    render: (r) => (
      <span className={cn('tabular-nums font-medium', r.saldoAtual <= 0 ? 'text-red-600 dark:text-red-400' : '')}>
        {fmtUnidades(r.saldoAtual)}
      </span>
    ),
  },
  { key: 'ultimaVenda', label: 'Últ. Venda', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtData(r.ultimaVenda)}</span> },
]

const EstoqueGeral = ({ data, categorias }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [saldo, setSaldo] = useState<'todos' | 'comSaldo' | 'zerado' | 'negativo'>('todos')

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (saldo === 'comSaldo' && !(r.saldoAtual > 0)) return false
      if (saldo === 'zerado' && r.saldoAtual !== 0) return false
      if (saldo === 'negativo' && !(r.saldoAtual < 0)) return false
      if (categoria && r.categoria !== categoria) return false
      if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase()) && !r.codigoSku.toLowerCase().includes(busca.toLowerCase()) && !(r.codigoBarras ?? '').includes(busca)) return false
      return true
    })
  }, [data, busca, categoria, saldo])

  const totals = useMemo(() => {
    const valor = filtered.reduce((s, r) => s + r.valorEstoque, 0)
    const unidades = filtered.reduce((s, r) => s + r.saldoAtual, 0)
    const zerados = filtered.filter((r) => r.saldoAtual <= 0).length
    return { valor, unidades, zerados }
  }, [filtered])

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={Boxes}
        iconColor="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-900/40"
        title="Estoque de todos os produtos"
        titleHint="Saldo atual de cada produto (não combustível), com preço de custo e de venda (tabela A) do CADASTRO, lucro bruto %, margem de lucro, cód. de barras, quantidade mínima e última venda. Valor em estoque = saldo × preço de custo do cadastro."
        subtitle={`${filtered.length} de ${data.length} produtos`}
        accentGradient="bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
        metrics={[
          { label: 'Total de unidades', value: fmtUnidades(totals.unidades) },
          { label: 'Valor em estoque', value: formatCurrency(totals.valor), color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Zerados', value: String(totals.zerados) },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto, SKU ou cód. barras..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <select
            value={saldo}
            onChange={(e) => setSaldo(e.target.value as 'todos' | 'comSaldo' | 'zerado' | 'negativo')}
            title="Filtro de saldo"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="todos">Todo saldo</option>
            <option value="comSaldo">Com saldo (&gt; 0)</option>
            <option value="zerado">Zerados</option>
            <option value="negativo">Negativos</option>
          </select>

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">Todas categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {(busca || categoria || saldo !== 'todos') && (
            <button
              onClick={() => { setBusca(''); setCategoria(''); setSaldo('todos') }}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Limpar
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.produtoCodigo}
          enableRowHighlight
          groups={[
            { label: '', span: 3 },             // Ref · Produto · Cód. Barras
            { label: 'Preço & margem', span: 5 }, // P. Custo · Lucro Bruto % · Tipo · P. Venda · Marg. Luc.
            { label: 'Estoque', span: 3 },       // Qtd. Mín. · Qtd · Últ. Venda
          ]}
        />

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {data.length} produtos
        </div>
      </div>
    </div>
  )
}

export default EstoqueGeral
