import { useState, useMemo } from 'react'
import { Search, ShoppingCart } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import TableSummaryStrip from '@/components/tables/TableSummaryStrip'
import CoberturaBadge, { diasEntreDatas } from '@/components/badges/CoberturaBadge'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { PROJECAO_TOOLTIP_PRODUTO } from '@/lib/projection'
import type { CatalogProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface ProductCatalogProps {
  products: CatalogProduct[]
  gruposList: string[]
}

const ProductCatalog = ({ products, gruposList }: ProductCatalogProps) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const diasPeriodo = useMemo(() => diasEntreDatas(dataInicial, dataFinal), [dataInicial, dataFinal])

  const [search, setSearch] = useState('')
  const [grupoFilter, setGrupoFilter] = useState('')
  const [sortBy, setSortBy] = useState<'faturamento' | 'qtdVendida' | 'margemPct'>('faturamento')

  const columns = useMemo<Column<CatalogProduct>[]>(() => [
    { key: 'nome', label: 'Produto', sortable: true },
    { key: 'grupo', label: 'Grupo', sortable: true },
    {
      key: 'precoMedioVenda', label: 'Preço Médio', align: 'right', sortable: true,
      render: (r) => formatCurrency(r.precoMedioVenda),
    },
    {
      key: 'custoMedio', label: 'Custo Médio', align: 'right', sortable: true,
      render: (r) => formatCurrency(r.custoMedio),
    },
    {
      key: 'qtdVendida', label: 'Qtd Vendida', align: 'right', sortable: true,
      render: (r) => formatNumber(r.qtdVendida),
    },
    {
      key: 'saldo', label: 'Cobertura', align: 'right', sortable: true,
      render: (r) => (
        <CoberturaBadge
          saldo={r.saldo}
          quantidade={r.qtdVendida}
          diasPeriodo={diasPeriodo}
        />
      ),
    },
    {
      key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true,
      render: (r) => formatCurrency(r.faturamento),
    },
    {
      key: 'projetado', label: 'Projeção', align: 'right', sortable: true,
      render: (r) => {
        const proj = r.projetado ?? r.faturamento
        const isProjetada = proj > r.faturamento + 0.01 // tolerância pra float
        return (
          <span
            className={cn(
              'tabular-nums cursor-help',
              isProjetada && 'font-semibold text-blue-700 dark:text-blue-400',
            )}
            title={PROJECAO_TOOLTIP_PRODUTO}
          >
            {formatCurrency(proj)}
          </span>
        )
      },
    },
    {
      key: 'margemPct', label: 'Margem %', align: 'right', sortable: true,
      render: (r) => (
        <HeatmapCell value={r.margemPct} min={-10} max={50} formatted={`${r.margemPct.toFixed(1)}%`} />
      ),
    },
    {
      key: 'ativo', label: 'Status', align: 'center', sortable: true,
      render: (r) => (
        <span className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
          r.ativo
            ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        )}>
          {r.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
  ], [diasPeriodo])

  const filtered = useMemo(() => {
    let result = products
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.nome.toLowerCase().includes(q) || p.grupo.toLowerCase().includes(q))
    }
    if (grupoFilter) {
      result = result.filter((p) => p.grupo === grupoFilter)
    }
    return [...result].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number))
  }, [products, search, grupoFilter, sortBy])

  const catalogTotals = useMemo(() => {
    const faturamento = filtered.reduce((s, p) => s + p.faturamento, 0)
    const lucroBruto = filtered.reduce((s, p) => s + (p.faturamento - (p.custoMedio * p.qtdVendida)), 0)
    const margemMedia = filtered.length > 0
      ? filtered.reduce((s, p) => s + p.margemPct, 0) / filtered.length
      : 0
    return { faturamento, lucroBruto, margemMedia }
  }, [filtered])

  return (
    <div className="space-y-4">
      <TableSummaryStrip
        icon={ShoppingCart}
        iconColor="text-orange-600"
        iconBg="bg-orange-100 dark:bg-orange-900/40"
        title="Catálogo de Produtos"
        subtitle={`${filtered.length} de ${products.length} produtos`}
        accentGradient="bg-gradient-to-r from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
        metrics={[
          { label: 'Faturamento', value: formatCurrency(catalogTotals.faturamento) },
          { label: 'Lucro Bruto', value: formatCurrency(catalogTotals.lucroBruto), color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Margem Média', value: `${catalogTotals.margemMedia.toFixed(1)}%` },
        ]}
      />

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto ou grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={grupoFilter}
              onChange={(e) => setGrupoFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">Todos os grupos</option>
              {gruposList.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Ordenar:</span>
            {(['faturamento', 'qtdVendida', 'margemPct'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  sortBy === key
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                )}
              >
                {key === 'faturamento' ? 'Vendas' : key === 'qtdVendida' ? 'Quantidade' : 'Margem'}
              </button>
            ))}
          </div>

          {(search || grupoFilter) && (
            <button
              onClick={() => { setSearch(''); setGrupoFilter('') }}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Limpar
            </button>
          )}
        </div>

        <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} enableRowHighlight />

        <div className="border-t border-gray-200 px-6 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          Exibindo {filtered.length} de {products.length} produtos
        </div>
      </div>
    </div>
  )
}

export default ProductCatalog
