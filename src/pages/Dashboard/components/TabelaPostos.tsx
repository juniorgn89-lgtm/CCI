import { Fuel, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import { useFilterStore } from '@/store/filters'
import { formatCurrency, formatLiters, formatPercent } from '@/lib/formatters'

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

  const empresas = (sectorDetails?.combustivel.empresas ?? [])
    .filter((e) => e.litros > 0)
    .map((e) => ({ ...e, faturamentoCalc: e.litros * e.precoVenda }))
    .sort((a, b) => b.faturamentoCalc - a.faturamentoCalc)

  const handleRowClick = (empresaCodigo: number) => {
    setEmpresas([empresaCodigo])
    navigate('/dashboard')
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
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
              : `${empresas.length} ${empresas.length === 1 ? 'posto' : 'postos'} no período · clique para ver detalhes`}
          </p>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && empresas.length === 0 ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/50"
            />
          ))}
        </div>
      ) : empresas.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhum posto com vendas de combustível no período.
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
              {empresas.map((emp) => (
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
