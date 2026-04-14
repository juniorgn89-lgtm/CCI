import { useEffect, useState } from 'react'
import { Warehouse, LayoutList, BarChart3, AlertTriangle, Clock, TrendingUp, Activity, Settings } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { cn } from '@/lib/utils'
import { useEstoquesLayout } from '@/store/moduleLayout'
import EstoqueIndicadores from '@/pages/Estoques/components/EstoqueIndicadores'
import StockTable from '@/pages/Estoques/components/StockTable'
import StockMovementChart from '@/pages/Estoques/components/StockMovementChart'
import StockAlerts, { type SeverityFilter } from '@/pages/Estoques/components/StockAlerts'
import StockHistory from '@/pages/Estoques/components/StockHistory'
import StockAnalysis from '@/pages/Estoques/components/StockAnalysis'
import useStockData from '@/pages/Estoques/hooks/useStockData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Warehouse> = {
  indicadores: Activity,
  posicao: LayoutList,
  movimentacao: BarChart3,
  alertas: AlertTriangle,
  historico: Clock,
  analise: TrendingUp,
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

const Estoques = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useEstoquesLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'indicadores')
  const [alertFilter, setAlertFilter] = useState<SeverityFilter>('all')

  const handleNavigate = (tab: string, filter?: SeverityFilter) => {
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

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'indicadores')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
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
        <ModuleSettings title="Estoques" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </div>

      {/* Empty state: no empresa selected */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content — only when empresa is selected */}
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
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
                {visibleTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab.id] ?? Warehouse
                  const alertCount = tab.id === 'alertas' ? alerts.length : 0
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
                      {alertCount > 0 && activeTab !== tab.id && (
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
                  {activeTab === 'indicadores' && kpis && (
                    <EstoqueIndicadores
                      kpis={kpis}
                      stockTable={stockTable}
                      alerts={alerts}
                      categoryStock={categoryStock}
                      statusBreakdown={statusBreakdown}
                      onNavigateTab={handleNavigate}
                    />
                  )}
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
        </>
      )}
    </div>
  )
}

export default Estoques
