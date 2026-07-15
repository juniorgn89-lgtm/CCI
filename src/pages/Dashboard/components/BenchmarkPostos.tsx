import { useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronRight, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import { useFilterStore } from '@/store/filters'
import { formatCurrency, formatLiters, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type SortKey = 'litros' | 'faturamento' | 'precoMedio' | 'participacao' | 'margem'

interface BenchRow {
  empresaCodigo: number
  empresa: string
  litros: number
  faturamento: number
  precoMedio: number
  participacao: number
  margem: number
  temCusto: boolean
}

/** Barra de proporção monocromática (sutil) — não é heatmap colorido. */
const ProporcaoBar = ({ value, max }: { value: number; max: number }) => (
  <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
    <div
      className="h-1 rounded-full bg-slate-300 dark:bg-slate-600"
      style={{ width: `${max > 0 ? Math.max(3, (value / max) * 100) : 0}%` }}
    />
  </div>
)

/**
 * Benchmark entre postos — compara todos os postos lado a lado no período.
 * Tabela ordenável, com barras de proporção discretas (litros/faturamento).
 * Substitui o antigo "Resumo combustível por posto".
 *
 * Margem: postos sem preço de custo (não apurados) aparecem como "sem custo"
 * — sem barra e sempre por último na ordenação por margem, pra não passarem
 * por "melhores" só por falta de dado.
 */
const BenchmarkPostos = () => {
  const navigate = useNavigate()
  const setEmpresas = useFilterStore((s) => s.setEmpresas)
  const { sectorDetails, isLoading } = useDashboardData()
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('faturamento')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const rows = useMemo<BenchRow[]>(() => {
    const empresas = (sectorDetails?.combustivel.empresas ?? []).filter((e) => e.litros > 0)
    const base = empresas.map((e) => ({
      empresaCodigo: e.empresaCodigo,
      empresa: e.empresa,
      litros: e.litros,
      faturamento: e.litros * e.precoVenda,
      precoMedio: e.precoVenda,
      margem: e.margem,
      temCusto: e.precoCusto > 0,
    }))
    const totalFat = base.reduce((s, r) => s + r.faturamento, 0)
    return base.map((r) => ({
      ...r,
      participacao: totalFat > 0 ? (r.faturamento / totalFat) * 100 : 0,
    }))
  }, [sectorDetails])

  const max = useMemo(
    () => ({
      litros: Math.max(0, ...rows.map((r) => r.litros)),
      faturamento: Math.max(0, ...rows.map((r) => r.faturamento)),
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q ? rows.filter((r) => r.empresa.toLowerCase().includes(q)) : rows
    return [...base].sort((a, b) => {
      // Sem custo não tem margem real → vai pro fim quando ordena por margem.
      if (sortKey === 'margem' && a.temCusto !== b.temCusto) return a.temCusto ? -1 : 1
      const av = a[sortKey]
      const bv = b[sortKey]
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [rows, search, sortKey, sortDir])

  const semCustoCount = rows.filter((r) => !r.temCusto).length
  const showSearch = rows.length > 3

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleRowClick = (empresaCodigo: number) => {
    setEmpresas([empresaCodigo])
    navigate('/dashboard')
  }

  // SortableTh é renderizado inline pra evitar re-criação de componente em
  // cada render (react-hooks/static-components). É só uma função que retorna JSX.
  const renderSortableTh = (label: string, k: SortKey) => (
    <th scope="col" className="px-3 py-2.5 text-right font-medium">
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="ml-auto inline-flex flex-row-reverse items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
      >
        {label}
        {sortKey === k ? (
          sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      {/* Header — clicável pra colapsar/expandir */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40',
          expanded && 'border-b border-gray-100 dark:border-gray-800',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Benchmark entre postos
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {isLoading
              ? 'Carregando comparativo dos postos...'
              : `Compara ${rows.length} ${rows.length === 1 ? 'posto' : 'postos'} lado a lado · clique pra ${expanded ? 'minimizar' : 'expandir'}`}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Busca por posto */}
      {expanded && showSearch && (
        <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar posto..."
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-300"
            />
          </div>
        </div>
      )}

      {!expanded ? null : isLoading && rows.length === 0 ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search.trim()
              ? 'Nenhum posto encontrado pra essa busca.'
              : 'Nenhum posto com vendas de combustível no período.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-transparent dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    Posto
                  </th>
                  {renderSortableTh('Litros', 'litros')}
                  {renderSortableTh('Faturamento', 'faturamento')}
                  {renderSortableTh('Preço médio', 'precoMedio')}
                  {renderSortableTh('Participação', 'participacao')}
                  {renderSortableTh('Margem', 'margem')}
                  <th className="w-8 px-2 py-2.5" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((r) => (
                  <tr
                    key={r.empresaCodigo}
                    onClick={() => handleRowClick(r.empresaCodigo)}
                    className="group cursor-pointer transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                      <span className="block max-w-[16rem] truncate" title={r.empresa}>
                        {r.empresa}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="tabular-nums text-gray-700 dark:text-gray-300">
                        {formatLiters(r.litros)}
                      </div>
                      <ProporcaoBar value={r.litros} max={max.litros} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(r.faturamento)}
                      </div>
                      <ProporcaoBar value={r.faturamento} max={max.faturamento} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {formatCurrency(r.precoMedio)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {formatPercent(r.participacao)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {r.temCusto ? (
                        <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {formatPercent(r.margem)}
                        </span>
                      ) : (
                        <span
                          title="Posto sem preço de custo (não apurado) — margem indisponível"
                          className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        >
                          sem custo
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {semCustoCount > 0 && (
            <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {semCustoCount} {semCustoCount === 1 ? 'posto' : 'postos'} sem preço de custo —
                margem disponível só após a apuração.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default BenchmarkPostos
