import { useMemo, useState } from 'react'
import { Fuel, ChevronRight, ChevronDown, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import { useFilterStore } from '@/store/filters'
import { formatCurrency, formatLiters, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const margemBadgeClass = (margem: number): string => {
  if (margem < 10) {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (margem < 12) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
}

const TabelaPostos = () => {
  const navigate = useNavigate()
  const setEmpresas = useFilterStore((s) => s.setEmpresas)
  const { sectorDetails, isLoading } = useDashboardData()
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const empresas = (sectorDetails?.combustivel.empresas ?? [])
    .filter((e) => e.litros > 0)
    .map((e) => ({ ...e, faturamentoCalc: e.litros * e.precoVenda }))
    .sort((a, b) => b.faturamentoCalc - a.faturamentoCalc)

  // Lista filtrada pela busca de posto
  const empresasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return empresas
    return empresas.filter((e) => e.empresa.toLowerCase().includes(q))
  }, [empresas, search])

  // Busca só faz sentido com vários postos
  const showSearch = empresas.length > 3

  const handleRowClick = (empresaCodigo: number) => {
    setEmpresas([empresaCodigo])
    navigate('/dashboard')
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
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
          <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Resumo combustível por posto
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {isLoading
              ? 'Carregando dados dos postos...'
              : `${empresas.length} ${empresas.length === 1 ? 'posto' : 'postos'} no período · clique pra ${expanded ? 'minimizar' : 'expandir'}`}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Busca por posto — só quando expandido e há postos suficientes */}
      {expanded && showSearch && (
        <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar posto..."
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            />
          </div>
        </div>
      )}

      {!expanded ? null : isLoading && empresas.length === 0 ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/50"
            />
          ))}
        </div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search.trim()
              ? 'Nenhum posto encontrado pra essa busca.'
              : 'Nenhum posto com vendas de combustível no período.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">
                  Posto
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Litros
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Faturamento
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Lucro Bruto
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Margem
                </th>
                <th scope="col" className="w-8 px-2 py-2.5" aria-label="Ações" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {empresasFiltradas.map((emp) => (
                <tr
                  key={emp.empresaCodigo}
                  onClick={() => handleRowClick(emp.empresaCodigo)}
                  className="group cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-900/10"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                    <span className="block max-w-[16rem] truncate" title={emp.empresa}>
                      {emp.empresa}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatLiters(emp.litros)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {formatCurrency(emp.faturamentoCalc)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(emp.lucroBruto)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${margemBadgeClass(emp.margem)}`}
                    >
                      {formatPercent(emp.margem)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default TabelaPostos
