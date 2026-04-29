import { useCallback, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import { cn } from '@/lib/utils'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)
const fmtGiro = (v: number) => v.toFixed(2)

const columns: Column<ProductAnalyticsRow>[] = [
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500">{r.categoria}</span> },
  { key: 'vendasUltimos6m', label: 'Vendas 6m', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.vendasUltimos6m)}</span> },
  { key: 'estoqueMedio', label: 'Estoque médio', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.estoqueMedio)}</span> },
  { key: 'saldoAtual', label: 'Saldo atual', align: 'right', sortable: true, render: (r) => <span className={cn('tabular-nums', r.saldoAtual <= 0 && 'text-red-600 dark:text-red-400')}>{fmtUnidades(r.saldoAtual)}</span> },
  {
    key: 'giro',
    label: 'Giro (6m)',
    align: 'right',
    sortable: true,
    render: (r) => (
      <HeatmapCell
        value={r.giro}
        min={0}
        max={6}
        formatted={r.giro > 0 ? fmtGiro(r.giro) + 'x' : '—'}
      />
    ),
  },
]

const csvColumns: ExportColumn<ProductAnalyticsRow>[] = [
  { header: 'Produto', accessor: (r) => r.produtoNome },
  { header: 'Categoria', accessor: (r) => r.categoria },
  { header: 'Vendas 6m', accessor: (r) => r.vendasUltimos6m },
  { header: 'Estoque médio', accessor: (r) => r.estoqueMedio },
  { header: 'Saldo atual', accessor: (r) => r.saldoAtual },
  { header: 'Giro 6m', accessor: (r) => r.giro },
]

const GiroProdutos = ({ data, categorias }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  const filtered = useMemo(() => {
    return data
      .filter((r) => {
        if (categoria && r.categoria !== categoria) return false
        if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase())) return false
        return true
      })
      .sort((a, b) => b.giro - a.giro)
  }, [data, busca, categoria])

  const totals = useMemo(() => {
    const comGiro = filtered.filter((r) => r.giro > 0)
    const giroMedio = comGiro.length > 0 ? comGiro.reduce((s, r) => s + r.giro, 0) / comGiro.length : 0
    const semGiro = filtered.length - comGiro.length
    return { giroMedio, comGiro: comGiro.length, semGiro }
  }, [filtered])

  const handleExport = useCallback(() => {
    exportToCsv('giro-produtos', filtered, csvColumns)
  }, [filtered])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Giro dos produtos</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Quantas vezes o estoque "girou" nos últimos 6 meses (vendas ÷ estoque médio)
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
          <ExportButton onExport={handleExport} />
        </div>
      </div>
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Produtos com giro: <span className="font-medium tabular-nums">{totals.comGiro}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] text-gray-500 dark:text-gray-400">
            Sem movimento: <span className="font-medium tabular-nums">{totals.semGiro}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            Giro médio: <span className="tabular-nums">{fmtGiro(totals.giroMedio)}x</span>
          </span>
        </div>
      )}
      <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} />
    </div>
  )
}

export default GiroProdutos
