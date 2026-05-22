import { lazy, Suspense } from 'react'
import { Store } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import RouteFallback from '@/components/feedback/RouteFallback'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'

const Conveniencias = lazy(() => import('@/pages/Conveniencias'))

/**
 * Comercial · Vendas · Conveniência — embute a tela completa de Conveniências
 * (KPIs + abas Indicadores/Vendas/Catálogo) dentro do guarda-chuva de
 * Comercial · Vendas. O header (título/data/settings) vem desta página;
 * o conteúdo interno é reaproveitado via prop `embedded`.
 */
const ComercialVendasConveniencia = () => {
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
                Vendas · Conveniência{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Vendas, catálogo, estoque e análise de performance da loja
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <VendasNav />

      <Suspense fallback={<RouteFallback />}>
        <Conveniencias embedded />
      </Suspense>
    </div>
  )
}

export default ComercialVendasConveniencia
