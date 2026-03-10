import { useState } from 'react'
import { Landmark, Receipt, CreditCard, BarChart3, FileSpreadsheet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import FinanceKpis from '@/pages/Financeiro/components/FinanceKpis'
import ReceivablesTable from '@/pages/Financeiro/components/ReceivablesTable'
import PayablesTable from '@/pages/Financeiro/components/PayablesTable'
import CashFlowChart from '@/pages/Financeiro/components/CashFlowChart'
import DreTable from '@/pages/Financeiro/components/DreTable'
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'

type TabKey = 'receber' | 'pagar' | 'fluxo' | 'dre'

const tabs: { key: TabKey; label: string; icon: typeof Receipt }[] = [
  { key: 'receber', label: 'Receber', icon: Receipt },
  { key: 'pagar', label: 'Pagar', icon: CreditCard },
  { key: 'fluxo', label: 'Fluxo de Caixa', icon: BarChart3 },
  { key: 'dre', label: 'DRE', icon: FileSpreadsheet },
]

const KpiSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="mt-3 h-8 w-32" />
    <Skeleton className="mt-2 h-3 w-40" />
  </div>
)

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
  const [activeTab, setActiveTab] = useState<TabKey>('receber')

  const handleNavigate = (tab: TabKey) => {
    setActiveTab(tab)
  }

  const {
    kpis,
    receivablesData,
    payablesData,
    cashFlowData,
    dreData,
    isLoading,
    hasEmpresa,
  } = useFinanceData()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Financeiro</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Contas a receber, contas a pagar, fluxo de caixa e DRE
            </p>
          </div>
        </div>
      </div>

      {/* Empty state: no empresa selected */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <FinanceKpis kpis={kpis} onNavigate={handleNavigate} />
          ) : null}

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const overdueCount = tab.key === 'receber'
                ? (kpis?.countVencidosReceber ?? 0)
                : tab.key === 'pagar'
                  ? (kpis?.countVencidosPagar ?? 0)
                  : 0
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {overdueCount > 0 && activeTab !== tab.key && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-600 dark:bg-red-900/50 dark:text-red-400">
                      {overdueCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Content */}
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <>
              {activeTab === 'receber' && (
                <ReceivablesTable data={receivablesData} />
              )}
              {activeTab === 'pagar' && (
                <PayablesTable data={payablesData} />
              )}
              {activeTab === 'fluxo' && (
                <CashFlowChart data={cashFlowData} />
              )}
              {activeTab === 'dre' && (
                <DreTable data={dreData} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Financeiro
