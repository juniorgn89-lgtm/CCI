import { useEffect, useState } from 'react'
import { Store, ShoppingCart, Package, Trophy, Settings, Activity, DollarSign, TrendingUp } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { useConvenienciasLayout } from '@/store/moduleLayout'
import ConvenienciaIndicadores from '@/pages/Conveniencias/components/ConvenienciaIndicadores'
import SalesOverview from '@/pages/Conveniencias/components/SalesOverview'
import ProductCatalog from '@/pages/Conveniencias/components/ProductCatalog'
import TopSellers from '@/pages/Conveniencias/components/TopSellers'

import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Store> = {
  indicadores: Activity,
  vendas: ShoppingCart,
  catalogo: Package,
  topVendidos: Trophy,
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
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'indicadores')
  const {
    kpis,
    dailyData,
    groupTable,
    revenueData,
    catalogProducts,
    topSellers,
    treemapData,
    gruposList,
    isLoading,
    hasEmpresa,
  } = useConvenienceData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'indicadores')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">Conveniência</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Vendas, catálogo, estoque e análise de performance da loja
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <ModuleSettings title="Conveniência" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </PageHeaderActions>

      {/* Empty state */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs principais — sempre visíveis acima das abas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveTab('vendas')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Faturamento</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatCurrency(kpis.faturamento)}
              </p>
              {kpis && <DeltaBadge current={kpis.faturamento} previous={kpis.prev.faturamento} />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vendas')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Margem Bruta</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatCurrency(kpis.margem)}
              </p>
              {kpis && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500">{kpis.margemPct.toFixed(1)}%</span>
                  <DeltaBadge current={kpis.margem} previous={kpis.prev.margem} />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('topVendidos')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-violet-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-violet-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Itens Vendidos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Package className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatNumber(kpis.qtdItens)}
              </p>
              {kpis && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatNumber(kpis.totalProdutos)} produtos</span>
                  <DeltaBadge current={kpis.qtdItens} previous={kpis.prev.qtdItens} />
                </div>
              )}
            </button>
          </div>

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
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
                  </div>
                  <ContentSkeleton />
                </div>
              ) : (
                <>
                  {activeTab === 'indicadores' && kpis && (
                    <ConvenienciaIndicadores
                      kpis={kpis}
                      dailyData={dailyData}
                      groupTable={groupTable}
                      topSellers={topSellers}
                      revenueData={revenueData}
                      onNavigateTab={setActiveTab}
                    />
                  )}
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
                  {activeTab === 'topVendidos' && (
                    <TopSellers
                      topSellers={topSellers}
                      treemapData={treemapData}
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
