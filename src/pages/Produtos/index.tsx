import { useEffect, useState } from 'react'
import { Package, List, BarChart3, Trophy, PieChart, Settings } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { cn } from '@/lib/utils'
import { useProdutosLayout } from '@/store/moduleLayout'
import ProductKpis from '@/pages/Produtos/components/ProductKpis'
import ProductTable from '@/pages/Produtos/components/ProductTable'
import TopSellersChart from '@/pages/Produtos/components/TopSellersChart'
import ParetoChart from '@/pages/Produtos/components/ParetoChart'
import AbcCurve from '@/pages/Produtos/components/AbcCurve'
import useProductData from '@/pages/Produtos/hooks/useProductData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Package> = {
  produtos: List,
  top: Trophy,
  pareto: BarChart3,
  abc: PieChart,
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

const Produtos = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useProdutosLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'produtos')
  const { kpis, productTable, topSellers, abcData, gruposList, isLoading, hasEmpresa } = useProductData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  const handleNavigate = (tab: string) => {
    setActiveTab(tab)
  }

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'produtos')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Produtos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Análise de vendas, ranking e curva ABC
            </p>
          </div>
        </div>
        <ModuleSettings title="Produtos" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </div>

      {/* Empty state: no empresa selected */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs */}
          {showSkeleton ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <ProductKpis kpis={kpis} onNavigate={handleNavigate} />
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
                  const Icon = TAB_ICONS[tab.id] ?? Package
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
                <TableSkeleton />
              ) : (
                <>
                  {activeTab === 'produtos' && <ProductTable data={productTable} grupos={gruposList} />}
                  {activeTab === 'top' && <TopSellersChart data={topSellers} />}
                  {activeTab === 'pareto' && <ParetoChart data={productTable} />}
                  {activeTab === 'abc' && <AbcCurve data={abcData} />}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Produtos
