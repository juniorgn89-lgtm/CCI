import { useMemo, useState } from 'react'
import { Search, ArrowUp, ArrowDown } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
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

const columns: Column<EnrichedRow>[] = [
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500">{r.categoria}</span> },
  { key: 'estoqueMedio', label: 'Estoque médio (6m)', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.estoqueMedio)}</span> },
  {
    key: 'saldoAtual',
    label: 'Saldo atual',
    align: 'right',
    sortable: true,
    render: (r) => <span className={cn('tabular-nums font-medium', r.saldoAtual <= 0 && 'text-red-600 dark:text-red-400')}>{fmtUnidades(r.saldoAtual)}</span>,
  },
  {
    key: 'variacaoVsMedia',
    label: 'Variação vs média',
    align: 'right',
    sortable: true,
    render: (r) => {
      if (r.estoqueMedio <= 0) return <span className="text-gray-400">—</span>
      const isUp = r.variacaoVsMedia >= 0
      return (
        <span className={cn('inline-flex items-center justify-end gap-1 tabular-nums font-medium', isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
          {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(r.variacaoVsMedia).toFixed(1)}%
        </span>
      )
    },
  },
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
        if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase())) return false
        return true
      })
      .sort((a, b) => b.estoqueMedio - a.estoqueMedio)
  }, [enriched, busca, categoria])

  const totals = useMemo(() => {
    const totalMedio = filtered.reduce((s, r) => s + r.estoqueMedio, 0)
    const totalAtual = filtered.reduce((s, r) => s + r.saldoAtual, 0)
    return { totalMedio, totalAtual, count: filtered.length }
  }, [filtered])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Estoque médio</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Média do saldo nos últimos 6 meses, comparada com o saldo atual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 w-48 rounded-md border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">Todas categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Produtos: <span className="font-medium tabular-nums">{totals.count}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Estoque médio total: <span className="font-medium tabular-nums">{fmtUnidades(totals.totalMedio)}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Saldo atual total: <span className="font-medium tabular-nums">{fmtUnidades(totals.totalAtual)}</span>
          </span>
        </div>
      )}
      <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} enableRowHighlight />
    </div>
  )
}

export default EstoqueMedio
