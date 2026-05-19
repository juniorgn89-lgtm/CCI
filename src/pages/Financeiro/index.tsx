import { useEffect, useState } from 'react'
import { Landmark, Receipt, CreditCard, BarChart3, Settings, Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import { cn } from '@/lib/utils'
import { useFinanceiroLayout } from '@/store/moduleLayout'
import FinanceiroIndicadores from '@/pages/Financeiro/components/FinanceiroIndicadores'
import ReceivablesTable from '@/pages/Financeiro/components/ReceivablesTable'
import PayablesTable from '@/pages/Financeiro/components/PayablesTable'
import CashFlowChart from '@/pages/Financeiro/components/CashFlowChart'
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Receipt> = {
  indicadores: Activity,
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
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'indicadores')

  const handleNavigate = (tab: string) => {
    setActiveTab(tab)
  }

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

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'indicadores')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">Financeiro</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Contas a receber, contas a pagar e fluxo de caixa
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <ModuleSettings title="Financeiro" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
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
              {/* Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
                {visibleTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab.id] ?? Receipt
                  // Badge representa SÓ contas vencidas (não total nem a vencer hoje).
                  // Cor vermelha + tooltip explícito para o usuário entender de cara.
                  const overdueCount = tab.id === 'receber'
                    ? (kpis?.countVencidosReceber ?? 0)
                    : tab.id === 'pagar'
                      ? (kpis?.countVencidosPagar ?? 0)
                      : 0
                  const badgeTitle = tab.id === 'receber'
                    ? `${overdueCount} ${overdueCount === 1 ? 'título a receber vencido' : 'títulos a receber vencidos'}`
                    : `${overdueCount} ${overdueCount === 1 ? 'conta a pagar vencida' : 'contas a pagar vencidas'}`
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {overdueCount > 0 && activeTab !== tab.id && (
                        <span
                          title={badgeTitle}
                          aria-label={badgeTitle}
                          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-600 dark:bg-red-900/50 dark:text-red-400"
                        >
                          {overdueCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Content */}
              {showSkeleton ? (
                <TableSkeleton />
              ) : (
                <>
                  {activeTab === 'indicadores' && kpis && (
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
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Financeiro
