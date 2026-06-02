import { useState } from 'react'
import { Warehouse, Package, RefreshCw, BarChart3, TrendingUp, ShoppingCart, Settings, LayoutDashboard } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { useEstoquesLayout } from '@/store/moduleLayout'
import EstoqueVisaoGeral from '@/pages/Estoques/components/abas/EstoqueVisaoGeral'
import EstoqueGeral from '@/pages/Estoques/components/abas/EstoqueGeral'
import GiroProdutos from '@/pages/Estoques/components/abas/GiroProdutos'
import EstoqueMedio from '@/pages/Estoques/components/abas/EstoqueMedio'
import MediaVendas from '@/pages/Estoques/components/abas/MediaVendas'
import NecessidadeEstoque from '@/pages/Estoques/components/abas/NecessidadeEstoque'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import EstoqueMobile from '@/pages/Estoques/EstoqueMobile'

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
  // Aba controlada pela URL (?tab=) pro flyout/deep link. `activeTab` é derivado:
  // se a aba do ?tab= estiver escondida via engrenagem, cai na primeira visível
  // (sem mutar estado/URL no render).
  const [tabParam, setActiveTab] = useTabParam<string>(
    'visao',
    (v): v is string => v != null && layoutTabs.some((t) => t.id === v),
  )
  const activeTab = visibleTabs.some((t) => t.id === tabParam) ? tabParam : (visibleTabs[0]?.id ?? tabParam)
  const [coberturaDias, setCoberturaDias] = useState(30)

  const { productAnalytics, kpis, categorias, isLoading, hasEmpresa } = useEstoqueAnalytics(coberturaDias)
  const showSkeleton = useShowSkeleton(isLoading, productAnalytics.length > 0)
  const isMobile = useIsMobile()

  // Mobile: tela própria (Reposição / Estoque / Giro).
  if (isMobile) return <EstoqueMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
              <Warehouse className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Estoques</h1>
            <FocusModeToggle />
          </div>
          {hasEmpresa && visibleTabs.length > 0 && (
            <TopBarTabs
              tabs={visibleTabs.map((t) => ({ id: t.id, label: t.label, Icon: TAB_ICONS[t.id] ?? Warehouse }))}
              active={activeTab}
              onChange={setActiveTab}
            />
          )}
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
              {/* Content (abas na TopBar) */}
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
