import { useEffect, useState } from 'react'
import { Store, ShoppingCart, Package, Warehouse, Trophy, BarChart3, Settings } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useConvenienciasLayout } from '@/store/moduleLayout'
import ConvenienceKpis from '@/pages/Conveniencias/components/ConvenienceKpis'
import SalesOverview from '@/pages/Conveniencias/components/SalesOverview'
import ProductCatalog from '@/pages/Conveniencias/components/ProductCatalog'
import StockView from '@/pages/Conveniencias/components/StockView'
import TopSellers from '@/pages/Conveniencias/components/TopSellers'
import PerformanceAnalysis from '@/pages/Conveniencias/components/PerformanceAnalysis'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Store> = {
  vendas: ShoppingCart,
  catalogo: Package,
  estoque: Warehouse,
  topVendidos: Trophy,
  performance: BarChart3,
}

const ContentSkeleton = () => (
  <div className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  </div>
)

const Conveniencias = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useConvenienciasLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'vendas')
  const {
    kpis,
    dailyData,
    groupTable,
    revenueData,
    catalogProducts,
    stockItems,
    stockSummary,
    topSellers,
    treemapData,
    highMargin,
    highVolume,
    lowSales,
    insights,
    gruposList,
    isLoading,
    hasEmpresa,
  } = useConvenienceData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'vendas')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Conveniência</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Vendas, catálogo, estoque e análise de performance da loja
            </p>
          </div>
        </div>
        <ModuleSettings title="Conveniência" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </div>

      {/* Empty state */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs */}
          {showSkeleton ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <ConvenienceKpis kpis={kpis} onNavigateTab={setActiveTab} />
          ) : null}

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
                  const Icon = TAB_ICONS[tab.id] ?? Store
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
                    </button>
                  )
                })}
              </div>

              {/* Content */}
              {showSkeleton ? (
                <ContentSkeleton />
              ) : (
                <>
                  {activeTab === 'vendas' && (
                    <SalesOverview
                      dailyData={dailyData}
                      groupTable={groupTable}
                      revenueData={revenueData}
                    />
                  )}
                  {activeTab === 'catalogo' && (
                    <ProductCatalog
                      products={catalogProducts}
                      gruposList={gruposList}
                    />
                  )}
                  {activeTab === 'estoque' && (
                    <StockView
                      stockItems={stockItems}
                      stockSummary={stockSummary}
                    />
                  )}
                  {activeTab === 'topVendidos' && (
                    <TopSellers
                      topSellers={topSellers}
                      treemapData={treemapData}
                    />
                  )}
                  {activeTab === 'performance' && (
                    <PerformanceAnalysis
                      highMargin={highMargin}
                      highVolume={highVolume}
                      lowSales={lowSales}
                      insights={insights}
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

export default Conveniencias
