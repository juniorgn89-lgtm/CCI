import { useMemo, useState } from 'react'
import { Search, ArrowUp, ArrowDown, Layers } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import { cn } from '@/lib/utils'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
}

interface EnrichedRow extends ProductAnalyticsRow {
  variacaoVsMedia: number
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)
const fmtData = (iso: string | null): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

const columns: Column<EnrichedRow>[] = [
  { key: 'codigoSku', label: 'Ref.', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigoSku || '—'}</span> },
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500 dark:text-gray-400">{r.categoria}</span> },
  { key: 'codigoBarras', label: 'Cód. Barras', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.codigoBarras || '—'}</span> },
  { key: 'estoqueMedio', label: 'Estoque médio (6m)', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.estoqueMedio)}</span> },
  {
    key: 'saldoAtual', label: 'Saldo atual', align: 'right', sortable: true,
    render: (r) => <span className={cn('tabular-nums font-medium', r.saldoAtual <= 0 && 'text-red-600 dark:text-red-400')}>{fmtUnidades(r.saldoAtual)}</span>,
  },
  {
    key: 'variacaoVsMedia', label: 'Variação vs média', align: 'right', sortable: true,
    render: (r) => {
      if (r.estoqueMedio <= 0) return <span className="text-gray-400">—</span>
      const isUp = r.variacaoVsMedia >= 0
      return (
        <span className={cn('inline-flex items-center justify-end gap-1 tabular-nums font-medium', isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
          {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(r.variacaoVsMedia).toFixed(0)}%
        </span>
      )
    },
  },
  { key: 'ultimaVenda', label: 'Últ. venda', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtData(r.ultimaVenda)}</span> },
]

const EstoqueMedio = ({ data, categorias }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  const enriched: EnrichedRow[] = useMemo(
    () => data.map((r) => ({
      ...r,
      variacaoVsMedia: r.estoqueMedio > 0 ? ((r.saldoAtual - r.estoqueMedio) / r.estoqueMedio) * 100 : 0,
    })),
    [data],
  )

  const filtered = useMemo(() => {
    return enriched
      .filter((r) => {
        if (categoria && r.categoria !== categoria) return false
        if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase()) && !r.codigoSku.toLowerCase().includes(busca.toLowerCase()) && !(r.codigoBarras ?? '').includes(busca)) return false
        return true
      })
      .sort((a, b) => b.estoqueMedio - a.estoqueMedio)
  }, [enriched, busca, categoria])

  const totals = useMemo(() => {
    const totalMedio = filtered.reduce((s, r) => s + r.estoqueMedio, 0)
    const totalAtual = filtered.reduce((s, r) => s + r.saldoAtual, 0)
    return { totalMedio, totalAtual }
  }, [filtered])

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={Layers}
        iconColor="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-900/40"
        title="Estoque médio"
        titleHint="Média do saldo nos últimos 6 meses comparada ao saldo atual. 'Variação vs média' mostra se o saldo de hoje está acima (verde) ou abaixo (vermelho) da média histórica do produto."
        subtitle={`${filtered.length} de ${data.length} produtos`}
        accentGradient="bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
        metrics={[
          { label: 'Estoque médio total', value: fmtUnidades(totals.totalMedio) },
          { label: 'Saldo atual total', value: fmtUnidades(totals.totalAtual), color: 'text-blue-600 dark:text-blue-400' },
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
            { label: '', span: 4 },              // Ref · Produto · Categoria · Cód. Barras
            { label: 'Estoque (6m)', span: 3 },  // Estoque médio · Saldo atual · Variação
            { label: '', span: 1 },              // Últ. venda
          ]}
        />

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {data.length} produtos
        </div>
      </div>
    </div>
  )
}

export default EstoqueMedio
