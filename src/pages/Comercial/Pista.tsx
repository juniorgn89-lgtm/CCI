import { Link } from 'react-router-dom'
import { Wrench, ArrowRight } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import ComercialNav from '@/pages/Comercial/ComercialNav'

/**
 * Comercial · Pista — vendas de produtos automotivos na pista (filtros, óleos,
 * palhetas, aditivos, baterias, acessórios). A versão atual segue em
 * /operacao/pista até que esta aba ganhe layout próprio.
 */
const ComercialPista = () => {
  const { empresaCodigos } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-900/30">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Comercial · Pista{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Produtos automotivos vendidos na pista
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <ComercialNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30">
            <Wrench className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            Em construção
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Esta aba trará a visão comercial dos automotivos da pista — ticket
            médio, mix por categoria, evolução e ranking. A versão atual da
            página de Pista segue acessível em Operação.
          </p>
          <div className="mt-6">
            <Link
              to="/operacao/pista"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Ver Operação · Pista
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComercialPista
