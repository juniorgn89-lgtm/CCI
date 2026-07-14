import { lazy, Suspense } from 'react'
import { Gauge, Fuel } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { useAuthStore } from '@/store/auth'
import { useFilterStore } from '@/store/filters'
import useIsMobile from '@/hooks/useIsMobile'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import OperacaoMobile from '@/pages/Operacao/OperacaoMobile'

const Bombas = lazy(() => import('@/pages/Bombas'))
const Reabastecimento = lazy(() => import('@/pages/Reabastecimento'))

type OperacaoTab = 'bombas' | 'reabastecimento'
const isOperacaoTab = (v: string | null): v is OperacaoTab =>
  v === 'bombas' || v === 'reabastecimento'

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/**
 * Módulo Operação (grupo Posto) — consolida Bombas + Reabastecimento em abas.
 * O shell dona o header + abas + período; cada corpo mantém seu próprio modelo
 * de posto (Bombas = seletor de um posto; Reabastecimento = empilha todos). A
 * aba Reabastecimento respeita a permissão `canVerReabastecimento`.
 */
const Operacao = () => {
  const canVerReab = useAuthStore((s) => s.canVerReabastecimento)
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const [tab, setTab] = useTabParam<OperacaoTab>('bombas', isOperacaoTab)
  const isMobile = useIsMobile()
  // ?tab=reabastecimento sem permissão → cai em Bombas.
  const activeTab: OperacaoTab = tab === 'reabastecimento' && !canVerReab ? 'bombas' : tab

  if (isMobile) return <OperacaoMobile />
  // Módulo gateado: exige EXATAMENTE 1 posto (não permite "Todos" nem múltiplos).
  if (empresaCodigos.length !== 1) return <SelectCompanyState />

  const tabs: TopBarTab[] = [
    { id: 'bombas', label: 'Bombas', Icon: Gauge },
    ...(canVerReab ? [{ id: 'reabastecimento', label: 'Reabastecimento', Icon: Fuel }] : []),
  ]

  return (
    <div className="space-y-6">
      {tabs.length > 1 && (
        <PageHeaderTitle>
          <TopBarTabs active={activeTab} onChange={(id) => setTab(id as OperacaoTab)} tabs={tabs} />
        </PageHeaderTitle>
      )}
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <Suspense fallback={<TabFallback />}>
        {activeTab === 'reabastecimento' ? <Reabastecimento embedded /> : <Bombas embedded />}
      </Suspense>
    </div>
  )
}

export default Operacao
