import { LayoutGrid } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'

/**
 * Comercial · Vendas — Visão Geral (aba padrão). Mix consolidado dos 3
 * segmentos comerciais (combustível + pista + conveniência). A próxima
 * iteração traz KPIs combinados de faturamento, participação por
 * segmento, taxa de conversão e evolução hora a hora.
 */
const ComercialVendasVisaoGeral = () => {
  const { empresaCodigos } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30">
            <LayoutGrid className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Vendas · Visão Geral{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Mix consolidado — combustível + pista + conveniência
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <VendasNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
            <LayoutGrid className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            Mix consolidado — em construção
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            A próxima iteração traz KPIs combinados de faturamento, participação por
            segmento, taxa de conversão e evolução hora a hora.
          </p>
        </div>
      )}
    </div>
  )
}

export default ComercialVendasVisaoGeral
