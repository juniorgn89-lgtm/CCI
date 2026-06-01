import { lazy, Suspense } from 'react'
import { Receipt } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import useIsMobile from '@/hooks/useIsMobile'
import FechamentosMobile from '@/pages/FechamentoCaixa/FechamentosMobile'

// Só a Visão Geral usa dados REAIS (useOperacaoData → caixas/turnos do Supabase
// + live). As abas legadas (Caixa Geral, Sangria, Sobras/Faltas, Diferença
// Encerrantes) eram mock e foram retiradas até terem fonte real — os arquivos
// seguem em components/ pra religar quando o backend de fechamento existir.
const VisaoGeral = lazy(() => import('@/pages/FechamentoCaixa/components/VisaoGeral'))

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const FechamentoCaixa = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const hasEmpresa = empresaCodigos.length > 0
  const isMobile = useIsMobile()

  // Mobile: tela própria (picker de caixas + relatório agregado).
  if (isMobile) return <FechamentosMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Fechamentos</h1>
            <FocusModeToggle />
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <Suspense fallback={<TabSkeleton />}>
          <VisaoGeral />
        </Suspense>
      )}
    </div>
  )
}

export default FechamentoCaixa
