import { useState } from 'react'
import { Warehouse, LayoutList, BarChart3, AlertTriangle, Clock, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import StockKpis from '@/pages/Estoques/components/StockKpis'
import StockTable from '@/pages/Estoques/components/StockTable'
import StockMovementChart from '@/pages/Estoques/components/StockMovementChart'
import StockAlerts, { type SeverityFilter } from '@/pages/Estoques/components/StockAlerts'
import StockHistory from '@/pages/Estoques/components/StockHistory'
import StockAnalysis from '@/pages/Estoques/components/StockAnalysis'
import useStockData from '@/pages/Estoques/hooks/useStockData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

type TabKey = 'posicao' | 'movimentacao' | 'alertas' | 'historico' | 'analise'

const tabs: { key: TabKey; label: string; icon: typeof Warehouse }[] = [
  { key: 'posicao', label: 'Posição', icon: LayoutList },
  { key: 'movimentacao', label: 'Movimentação', icon: BarChart3 },
  { key: 'alertas', label: 'Alertas', icon: AlertTriangle },
  { key: 'historico', label: 'Histórico', icon: Clock },
  { key: 'analise', label: 'Análise', icon: TrendingUp },
]

const KpiSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="mt-3 h-8 w-32" />
    <Skeleton className="mt-2 h-3 w-20" />
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

const Estoques = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('posicao')
  const [alertFilter, setAlertFilter] = useState<SeverityFilter>('all')

  const handleNavigate = (tab: TabKey, filter?: SeverityFilter) => {
    setActiveTab(tab)
    setAlertFilter(filter ?? 'all')
  }
  const {
    kpis,
    stockTable,
    movementHistory,
    alerts,
    categorias,
    categoryStock,
    statusBreakdown,
    isLoading,
    hasEmpresa,
  } = useStockData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Warehouse className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Estoque</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Controle de produtos, movimentações e alertas
            </p>
          </div>
        </div>
      </div>

      {/* Empty state: no empresa selected */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content — only when empresa is selected */}
      {hasEmpresa && (
        <>
          {/* KPIs */}
          {showSkeleton ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <StockKpis kpis={kpis} onNavigate={handleNavigate} />
          ) : null}

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const alertCount = tab.key === 'alertas' ? alerts.length : 0
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
                  {alertCount > 0 && activeTab !== tab.key && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-600 dark:bg-red-900/50 dark:text-red-400">
                      {alertCount}
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
              {activeTab === 'posicao' && (
                <StockTable data={stockTable} categorias={categorias} />
              )}
              {activeTab === 'movimentacao' && (
                <StockMovementChart categoryStock={categoryStock} statusBreakdown={statusBreakdown} />
              )}
              {activeTab === 'alertas' && (
                <StockAlerts alerts={alerts} initialFilter={alertFilter} />
              )}
              {activeTab === 'historico' && (
                <StockHistory data={movementHistory} />
              )}
              {activeTab === 'analise' && <StockAnalysis />}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Estoques
