import { useState } from 'react'
import { Package, List, BarChart3, Trophy, PieChart } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import ProductKpis from '@/pages/Produtos/components/ProductKpis'
import ProductTable from '@/pages/Produtos/components/ProductTable'
import TopSellersChart from '@/pages/Produtos/components/TopSellersChart'
import ParetoChart from '@/pages/Produtos/components/ParetoChart'
import AbcCurve from '@/pages/Produtos/components/AbcCurve'
import useProductData from '@/pages/Produtos/hooks/useProductData'

type TabKey = 'produtos' | 'top' | 'pareto' | 'abc'

const tabs: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: 'produtos', label: 'Produtos', icon: List },
  { key: 'top', label: 'Mais vendidos', icon: Trophy },
  { key: 'pareto', label: 'Pareto', icon: BarChart3 },
  { key: 'abc', label: 'Curva ABC', icon: PieChart },
]

const KpiSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="mt-3 h-7 w-32" />
    <Skeleton className="mt-2 h-4 w-16" />
  </div>
)

const Produtos = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('produtos')
  const { empresaCodigo } = useFilterStore()
  const { kpis, productTable, topSellers, abcData, gruposList, isLoading } = useProductData()

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Produtos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Análise de vendas e desempenho por produto</p>
          </div>
        </div>
      </div>

      {!empresaCodigo ? <SelectCompanyState /> : (<>
      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : kpis ? (
        <ProductKpis kpis={kpis} />
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
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'produtos' && <ProductTable data={productTable} grupos={gruposList} />}
          {activeTab === 'top' && <TopSellersChart data={topSellers} />}
          {activeTab === 'pareto' && <ParetoChart data={productTable} />}
          {activeTab === 'abc' && <AbcCurve data={abcData} />}
        </>
      )}
      </>)}
    </div>
  )
}

export default Produtos
