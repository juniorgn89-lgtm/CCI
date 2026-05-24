import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import { formatCurrency } from '@/lib/formatters'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)

const formatMonthLabel = (ym: string): string => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const idx = Number(m) - 1
  return `${names[idx] ?? m}/${y.slice(2)}`
}

const columns: Column<ProductAnalyticsRow>[] = [
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500">{r.categoria}</span> },
  {
    key: 'vendasUltimos6m',
    label: 'Vendas 6m',
    align: 'right',
    sortable: true,
    render: (r) => <span className="tabular-nums">{fmtUnidades(r.vendasUltimos6m)}</span>,
  },
  {
    key: 'mediaMensalVendas',
    label: 'Média mensal',
    align: 'right',
    sortable: true,
    render: (r) => <span className="tabular-nums font-semibold">{fmtUnidades(r.mediaMensalVendas)}</span>,
  },
  {
    key: 'vendasPico',
    label: 'Mês pico',
    align: 'right',
    sortable: true,
    render: (r) => (
      r.mesPico ? (
        <div className="text-right">
          <p className="tabular-nums">{fmtUnidades(r.vendasPico)}</p>
          <p className="text-[10px] text-gray-400">{formatMonthLabel(r.mesPico)}</p>
        </div>
      ) : <span className="text-gray-400">—</span>
    ),
  },
  {
    key: 'receitaUltimos6m',
    label: 'Receita 6m',
    align: 'right',
    sortable: true,
    render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.receitaUltimos6m)}</span>,
  },
]

const MediaVendas = ({ data, categorias }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  const filtered = useMemo(() => {
    return data
      .filter((r) => {
        if (categoria && r.categoria !== categoria) return false
        if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase())) return false
        if (r.vendasUltimos6m === 0) return false // só produtos que venderam algo
        return true
      })
      .sort((a, b) => b.vendasUltimos6m - a.vendasUltimos6m)
  }, [data, busca, categoria])

  const totals = useMemo(() => {
    const totalVendas = filtered.reduce((s, r) => s + r.vendasUltimos6m, 0)
    const totalReceita = filtered.reduce((s, r) => s + r.receitaUltimos6m, 0)
    return { totalVendas, totalReceita, count: filtered.length }
  }, [filtered])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Média de venda dos últimos 6 meses</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Volume vendido por produto, com média mensal e mês de pico
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
            Produtos com venda: <span className="font-medium tabular-nums">{totals.count}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Total vendido (6m): <span className="font-medium tabular-nums">{fmtUnidades(totals.totalVendas)}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            Receita (6m): <span className="tabular-nums">{formatCurrency(totals.totalReceita)}</span>
          </span>
        </div>
      )}
      <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} enableRowHighlight />
    </div>
  )
}

export default MediaVendas
