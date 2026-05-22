import { useEffect, useState } from 'react'
import { Warehouse, Package, DollarSign, RefreshCw, BarChart3, TrendingUp, ShoppingCart, Settings } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { useEstoquesLayout } from '@/store/moduleLayout'
import EstoqueGeral from '@/pages/Estoques/components/abas/EstoqueGeral'
import GiroProdutos from '@/pages/Estoques/components/abas/GiroProdutos'
import EstoqueMedio from '@/pages/Estoques/components/abas/EstoqueMedio'
import MediaVendas from '@/pages/Estoques/components/abas/MediaVendas'
import NecessidadeEstoque from '@/pages/Estoques/components/abas/NecessidadeEstoque'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Warehouse> = {
  geral: Package,
  giro: RefreshCw,
  estoqueMedio: BarChart3,
  mediaVendas: TrendingUp,
  necessidade: ShoppingCart,
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)

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

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'geral')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Warehouse className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
                Estoque{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
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
          {/* KPIs no topo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de produtos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton ? '—' : fmtUnidades(kpis?.totalProdutos ?? 0)}
              </p>
              <p className="text-xs text-gray-500">não-combustíveis com saldo ou movimentação</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Valor total em estoque</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton ? '—' : formatCurrency(kpis?.valorTotalEstoque ?? 0)}
              </p>
              <p className="text-xs text-gray-500">a custo médio dos últimos 6 meses</p>
            </div>
          </div>

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
