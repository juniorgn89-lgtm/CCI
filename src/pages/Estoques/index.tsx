import { useState } from 'react'
import { Warehouse, Package, RefreshCw, BarChart3, TrendingUp, ShoppingCart, Settings, LayoutDashboard } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { cn } from '@/lib/utils'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { useEstoquesLayout } from '@/store/moduleLayout'
import EstoqueVisaoGeral from '@/pages/Estoques/components/abas/EstoqueVisaoGeral'
import EstoqueGeral from '@/pages/Estoques/components/abas/EstoqueGeral'
import GiroProdutos from '@/pages/Estoques/components/abas/GiroProdutos'
import EstoqueMedio from '@/pages/Estoques/components/abas/EstoqueMedio'
import MediaVendas from '@/pages/Estoques/components/abas/MediaVendas'
import NecessidadeEstoque from '@/pages/Estoques/components/abas/NecessidadeEstoque'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Warehouse> = {
  visao: LayoutDashboard,
  geral: Package,
  giro: RefreshCw,
  estoqueMedio: BarChart3,
  mediaVendas: TrendingUp,
  necessidade: ShoppingCart,
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
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'geral')
  const [coberturaDias, setCoberturaDias] = useState(30)

  const { productAnalytics, kpis, categorias, isLoading, hasEmpresa } = useEstoqueAnalytics(coberturaDias)
  const empresaNome = useEmpresaNome()
  const showSkeleton = useShowSkeleton(isLoading, productAnalytics.length > 0)

  // Se o usuário escondeu a aba ativa via engrenagem, ajusta pra primeira
  // visível direto no render (padrão da doc do React pra "store info from
  // previous renders", mais limpo que useEffect + setState).
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0].id)
  }

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/30">
            <Warehouse className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Estoque{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Giro, médias, vendas e necessidade de compra dos últimos 6 meses
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <HeaderTray>
        <ModuleSettings title="Estoques" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </HeaderTray>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* Tabs */}
          {visibleTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
              <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma aba visível. Use o botão ⚙️ para personalizar.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
                {visibleTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab.id] ?? Warehouse
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
                  {activeTab === 'visao' && (
                    <EstoqueVisaoGeral
                      data={productAnalytics}
                      categorias={categorias}
                      kpis={kpis ?? null}
                      onNavigateTab={setActiveTab}
                    />
                  )}
                  {activeTab === 'geral' && <EstoqueGeral data={productAnalytics} categorias={categorias} />}
                  {activeTab === 'giro' && <GiroProdutos data={productAnalytics} categorias={categorias} />}
                  {activeTab === 'estoqueMedio' && <EstoqueMedio data={productAnalytics} categorias={categorias} />}
                  {activeTab === 'mediaVendas' && <MediaVendas data={productAnalytics} categorias={categorias} />}
                  {activeTab === 'necessidade' && (
                    <NecessidadeEstoque
                      data={productAnalytics}
                      categorias={categorias}
                      coberturaDias={coberturaDias}
                      onCoberturaChange={setCoberturaDias}
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

export default Estoques
