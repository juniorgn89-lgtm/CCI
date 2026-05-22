import { Link } from 'react-router-dom'
import { GitMerge, Fuel, Wrench, DollarSign, TrendingUp } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import OperacaoNav from '@/pages/Operacao/OperacaoNav'

/* ─── Placeholder ─── */

/**
 * Mix — visão consolidada da pista (combustível + automotivos).
 *
 * TODO (próxima iteração):
 *  - KPIs combinados: faturamento total da pista, ticket médio, % de cada
 *  - Taxa de conversão: produtos automotivos vendidos a cada N abastecimentos
 *  - Correlação: qual combustível "puxa" mais venda de automotivo
 *  - Gráfico hora a hora: dinheiro entrando por categoria
 *
 * Por enquanto é só um placeholder com a estrutura.
 */
const OperacaoMix = () => {
  const { empresaCodigos } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-900/30">
            <GitMerge className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Mix{empresaNome ? ` · ${empresaNome}` : ' · Combustível + Automotivos'}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Visão consolidada da pista
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Switcher entre Combustível / Pista / Mix */}
      <OperacaoNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/30">
            <GitMerge className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            Em construção
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            A visão consolidada da pista chegará na próxima iteração. Vai cruzar combustível e produtos automotivos pra mostrar:
          </p>
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
              <span>Faturamento total da pista (combustível + automotivos) com participação de cada</span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
              <span>Taxa de conversão: produtos automotivos vendidos a cada N abastecimentos</span>
            </li>
            <li className="flex items-start gap-2">
              <Fuel className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
              <span>Quais combustíveis "puxam" mais venda de automotivo</span>
            </li>
            <li className="flex items-start gap-2">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
              <span>Hora a hora: dinheiro entrando por categoria</span>
            </li>
          </ul>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Link
              to="/operacao/combustivel"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Fuel className="h-3.5 w-3.5" />
              Ver Combustível
            </Link>
            <Link
              to="/operacao/pista"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Wrench className="h-3.5 w-3.5" />
              Ver Pista
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default OperacaoMix
