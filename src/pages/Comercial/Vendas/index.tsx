import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, Fuel, Wrench, Store } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'

const VisaoGeral = lazy(() => import('@/pages/Comercial/Vendas/VisaoGeral'))
const Combustivel = lazy(() => import('@/pages/Comercial/Vendas/Combustivel'))
const Pista = lazy(() => import('@/pages/Comercial/Vendas/Pista'))
const Conveniencia = lazy(() => import('@/pages/Comercial/Vendas/Conveniencia'))

type TabId = 'visao' | 'combustivel' | 'pista' | 'conveniencia'

const TABS: { id: TabId; label: string; Icon: typeof Fuel; subtitle: string }[] = [
  { id: 'visao', label: 'Visão Geral', Icon: LayoutGrid, subtitle: 'Mix consolidado — combustível + pista + conveniência' },
  { id: 'combustivel', label: 'Combustível', Icon: Fuel, subtitle: 'Litros, faturamento, ticket médio e mix por tipo de combustível' },
  { id: 'pista', label: 'Pista', Icon: Wrench, subtitle: 'Filtros, óleos, palhetas, aditivos, baterias e acessórios' },
  { id: 'conveniencia', label: 'Conveniência', Icon: Store, subtitle: 'Análise de Pareto, Curva ABC e catálogo de produtos da loja' },
]

const isTabId = (v: string | null): v is TabId =>
  v === 'visao' || v === 'combustivel' || v === 'pista' || v === 'conveniencia'

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

/**
 * Página única do módulo Vendas com 4 abas. As sub-páginas (VisaoGeral,
 * Combustível, Pista, Conveniência) são montadas com `embedded={true}` —
 * skipam seu próprio header e usam o desta página.
 *
 * Sync da aba ativa com query param `?tab=` pra deep links de notificações
 * e bookmarks. Rotas antigas (/comercial/vendas/{combustivel,pista,conveniencia})
 * redirecionam pra cá com o `?tab=` correto.
 */
const ComercialVendas = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryTab = searchParams.get('tab')
  const initialTab: TabId = isTabId(queryTab) ? queryTab : 'visao'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  // Sync URL quando aba muda externamente (via clique) — preserva os outros
  // params se existirem.
  const handleSetTab = (tab: TabId) => {
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    if (tab === 'visao') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  // Sync state quando query param muda (vindo de redirect/notificação)
  const [prevQueryTab, setPrevQueryTab] = useState(queryTab)
  if (queryTab !== prevQueryTab) {
    setPrevQueryTab(queryTab)
    const next: TabId = isTabId(queryTab) ? queryTab : 'visao'
    if (next !== activeTab) setActiveTab(next)
  }

  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const hasEmpresa = empresaCodigos.length > 0

  return (
    <div className="relative space-y-6">
      <PageHeaderTitle>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          {/* Título curto + Modo Foco (igual ao padrão da Inteligência) */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
              <LayoutGrid className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Vendas</h1>
            <FocusModeToggle />
          </div>

          {/* Abas dentro da TopBar (consolidadas, sem barra separada) */}
          {hasEmpresa && (
            <div className="flex items-center gap-0.5 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSetTab(tab.id)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-xs font-medium transition-all',
                      isActive
                        ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-gray-100'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                    )}
                    title={tab.subtitle}
                  >
                    <tab.Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'visao' && <VisaoGeral embedded />}
          {activeTab === 'combustivel' && <Combustivel embedded />}
          {activeTab === 'pista' && <Pista embedded />}
          {activeTab === 'conveniencia' && <Conveniencia embedded />}
        </Suspense>
      )}

      {/* Gradiente azul claro de fundo só na aba Visão Geral. Fica por ÚLTIMO no
          flow (mas é absolute + -z-10 + pointer-events-none, então o visual não
          muda) pra não virar primeiro irmão do space-y-6 e empurrar a barra de
          abas — assim o espaço cabeçalho↔menu fica igual ao das outras telas. */}
      {activeTab === 'visao' && hasEmpresa && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-6 -inset-y-6 -z-10 bg-gradient-to-br from-sky-100 via-blue-50 to-white dark:from-sky-950/30 dark:via-blue-950/20 dark:to-gray-950"
        />
      )}
    </div>
  )
}

export default ComercialVendas
