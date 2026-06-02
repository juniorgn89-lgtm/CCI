import { lazy, Suspense } from 'react'
import { Landmark, Receipt, CreditCard, BarChart3, Settings, LayoutDashboard } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { useFinanceiroLayout } from '@/store/moduleLayout'
// Conteúdo das abas em chunks separados (recharts só baixa quando a aba abre).
const FinanceiroIndicadores = lazy(() => import('@/pages/Financeiro/components/FinanceiroIndicadores'))
const ReceivablesTable = lazy(() => import('@/pages/Financeiro/components/ReceivablesTable'))
const PayablesTable = lazy(() => import('@/pages/Financeiro/components/PayablesTable'))
const CashFlowChart = lazy(() => import('@/pages/Financeiro/components/CashFlowChart'))
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import FinanceiroMobile from '@/pages/Financeiro/FinanceiroMobile'

const TAB_ICONS: Record<string, typeof Receipt> = {
  visao: LayoutDashboard,
  receber: Receipt,
  pagar: CreditCard,
  fluxo: BarChart3,
}

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Financeiro = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useFinanceiroLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) pro flyout/deep link. `activeTab` é derivado:
  // se a aba do ?tab= estiver escondida via engrenagem, cai na primeira visível.
  const [tabParam, setActiveTab] = useTabParam<string>(
    'visao',
    (v): v is string => v != null && layoutTabs.some((t) => t.id === v),
  )
  const activeTab = visibleTabs.some((t) => t.id === tabParam) ? tabParam : (visibleTabs[0]?.id ?? tabParam)

  const handleNavigate = (tab: string) => setActiveTab(tab)

  const {
    kpis,
    receivablesData,
    payablesData,
    cashFlowData,
    cashFlowTotals,
    cashFlowPrevTotals,
    isLoading,
    hasEmpresa,
  } = useFinanceData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const isMobile = useIsMobile()

  // Mobile: tela própria (Visão Geral / Receber / Pagar / Fluxo).
  if (isMobile) return <FinanceiroMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
              <Landmark className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Financeiro</h1>
            <FocusModeToggle />
          </div>
          {hasEmpresa && visibleTabs.length > 0 && (
            <TopBarTabs
              active={activeTab}
              onChange={setActiveTab}
              tabs={visibleTabs.map((t) => {
                const overdue = t.id === 'receber'
                  ? (kpis?.countVencidosReceber ?? 0)
                  : t.id === 'pagar'
                    ? (kpis?.countVencidosPagar ?? 0)
                    : 0
                const badgeTitle = t.id === 'receber'
                  ? `${overdue} ${overdue === 1 ? 'título a receber vencido' : 'títulos a receber vencidos'}`
                  : `${overdue} ${overdue === 1 ? 'conta a pagar vencida' : 'contas a pagar vencidas'}`
                return {
                  id: t.id,
                  label: t.label,
                  Icon: TAB_ICONS[t.id] ?? Receipt,
                  badge: overdue > 0 && activeTab !== t.id ? (
                    <span
                      title={badgeTitle}
                      aria-label={badgeTitle}
                      className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-100 px-1 text-[9px] font-bold text-red-600 dark:bg-red-900/50 dark:text-red-400"
                    >
                      {overdue}
                    </span>
                  ) : undefined,
                }
              })}
            />
          )}
        </div>
      </PageHeaderTitle>
      <HeaderTray>
        <ModuleSettings title="Financeiro" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </HeaderTray>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Empty state: no empresa selected */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {visibleTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
              <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma aba visível. Use o botão ⚙️ para personalizar.</p>
            </div>
          ) : (
            <>
              {/* Content (abas na TopBar) */}
              {showSkeleton ? (
                <TableSkeleton />
              ) : (
                <Suspense fallback={<TableSkeleton />}>
                  {activeTab === 'visao' && kpis && (
                    <FinanceiroIndicadores
                      kpis={kpis}
                      receivablesData={receivablesData}
                      payablesData={payablesData}
                      cashFlowData={cashFlowData}
                      onNavigateTab={handleNavigate}
                    />
                  )}
                  {activeTab === 'receber' && (
                    <ReceivablesTable data={receivablesData} />
                  )}
                  {activeTab === 'pagar' && (
                    <PayablesTable data={payablesData} />
                  )}
                  {activeTab === 'fluxo' && (
                    <CashFlowChart
                      data={cashFlowData}
                      totals={cashFlowTotals}
                      prevTotals={cashFlowPrevTotals}
                    />
                  )}
                </Suspense>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Financeiro
