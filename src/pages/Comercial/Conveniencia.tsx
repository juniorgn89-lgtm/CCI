import { Link } from 'react-router-dom'
import { Store, ArrowRight } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import ComercialNav from '@/pages/Comercial/ComercialNav'

/**
 * Comercial · Conveniência — vendas da loja de conveniência. A página
 * completa de Conveniências segue em /conveniencias enquanto esta aba
 * recebe layout dedicado.
 */
const ComercialConveniencia = () => {
  const { empresaCodigos } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/30">
            <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Comercial · Conveniência{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Vendas da loja de conveniência
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
            <Store className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            Em construção
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Esta aba trará a visão comercial da loja — KPIs, vendas por
            categoria e catálogo, dentro do guarda-chuva de Comercial. A
            página atual de Conveniências segue ativa enquanto isso.
          </p>
          <div className="mt-6">
            <Link
              to="/conveniencias"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Ver Conveniências
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComercialConveniencia
