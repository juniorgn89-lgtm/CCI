import { useState } from 'react'
import { Store, ShoppingCart, Package, Warehouse, Trophy, BarChart3 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import ConvenienceKpis from '@/pages/Conveniencias/components/ConvenienceKpis'
import SalesOverview from '@/pages/Conveniencias/components/SalesOverview'
import ProductCatalog from '@/pages/Conveniencias/components/ProductCatalog'
import StockView from '@/pages/Conveniencias/components/StockView'
import TopSellers from '@/pages/Conveniencias/components/TopSellers'
import PerformanceAnalysis from '@/pages/Conveniencias/components/PerformanceAnalysis'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'

type TabKey = 'vendas' | 'catalogo' | 'estoque' | 'topVendidos' | 'performance'

const tabs: { key: TabKey; label: string; icon: typeof Store }[] = [
  { key: 'vendas', label: 'Vendas', icon: ShoppingCart },
  { key: 'catalogo', label: 'Catálogo', icon: Package },
  { key: 'estoque', label: 'Estoque', icon: Warehouse },
  { key: 'topVendidos', label: 'Mais Vendidos', icon: Trophy },
  { key: 'performance', label: 'Performance', icon: BarChart3 },
]

const KpiSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-2 h-3 w-20" />
  </div>
)

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
  const [activeTab, setActiveTab] = useState<TabKey>('vendas')
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
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
      </div>

      {/* Empty state */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <ConvenienceKpis kpis={kpis} onNavigateTab={setActiveTab} />
          ) : null}

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon
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
                </button>
              )
            })}
          </div>

          {/* Content */}
          {isLoading ? (
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
    </div>
  )
}

export default Conveniencias
