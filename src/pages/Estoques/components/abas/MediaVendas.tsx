import { useMemo, useState } from 'react'
import { Search, TrendingUp } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { formatCurrency } from '@/lib/formatters'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)
const fmtData = (iso: string | null): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

const formatMonthLabel = (ym: string): string => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const idx = Number(m) - 1
  return `${names[idx] ?? m}/${y.slice(2)}`
}

const columns: Column<ProductAnalyticsRow>[] = [
  { key: 'codigoSku', label: 'Ref.', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigoSku || '—'}</span> },
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500 dark:text-gray-400">{r.categoria}</span> },
  { key: 'codigoBarras', label: 'Cód. Barras', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigoBarras || '—'}</span> },
  { key: 'vendasUltimos6m', label: 'Vendas 6m', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.vendasUltimos6m)}</span> },
  { key: 'mediaMensalVendas', label: 'Média mensal', align: 'right', sortable: true, render: (r) => <span className="tabular-nums font-semibold">{fmtUnidades(r.mediaMensalVendas)}</span> },
  {
    key: 'vendasPico', label: 'Mês pico', align: 'right', sortable: true,
    render: (r) => (
      r.mesPico ? (
        <div className="text-right">
          <p className="tabular-nums">{fmtUnidades(r.vendasPico)}</p>
          <p className="text-[10px] text-gray-400">{formatMonthLabel(r.mesPico)}</p>
        </div>
      ) : <span className="text-gray-400">—</span>
    ),
  },
  { key: 'receitaUltimos6m', label: 'Receita 6m', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.receitaUltimos6m)}</span> },
  { key: 'saldoAtual', label: 'Saldo atual', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.saldoAtual)}</span> },
  { key: 'ultimaVenda', label: 'Últ. venda', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtData(r.ultimaVenda)}</span> },
]

const MediaVendas = ({ data, categorias }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  const filtered = useMemo(() => {
    return data
      .filter((r) => {
        if (categoria && r.categoria !== categoria) return false
        if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase()) && !r.codigoSku.toLowerCase().includes(busca.toLowerCase()) && !(r.codigoBarras ?? '').includes(busca)) return false
        if (r.vendasUltimos6m === 0) return false // só produtos que venderam algo
        return true
      })
      .sort((a, b) => b.vendasUltimos6m - a.vendasUltimos6m)
  }, [data, busca, categoria])

  const totals = useMemo(() => {
    const totalVendas = filtered.reduce((s, r) => s + r.vendasUltimos6m, 0)
    const totalReceita = filtered.reduce((s, r) => s + r.receitaUltimos6m, 0)
    return { totalVendas, totalReceita }
  }, [filtered])

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={TrendingUp}
        iconColor="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-900/40"
        title="Média de venda dos últimos 6 meses"
        titleHint="Volume vendido por produto nos últimos 6 meses, com média mensal, mês de pico (maior volume) e receita do período. Só lista produtos que tiveram alguma venda."
        subtitle={`${filtered.length} de ${data.length} produtos`}
        accentGradient="bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
        metrics={[
          { label: 'Total vendido (6m)', value: fmtUnidades(totals.totalVendas) },
          { label: 'Receita (6m)', value: formatCurrency(totals.totalReceita), color: 'text-blue-600 dark:text-blue-400' },
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
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(r) => r.produtoCodigo}
          enableRowHighlight
          groups={[
            { label: '', span: 4 },             // Ref · Produto · Categoria · Cód. Barras
            { label: 'Vendas (6m)', span: 4 },  // Vendas 6m · Média mensal · Mês pico · Receita 6m
            { label: 'Estoque', span: 2 },      // Saldo atual · Últ. venda
          ]}
        />

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {data.length} produtos
        </div>
      </div>
    </div>
  )
}

export default MediaVendas
