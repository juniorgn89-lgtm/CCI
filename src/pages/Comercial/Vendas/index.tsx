import { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, Fuel, Wrench, Store, Menu, Check } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'

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

  // Detecta scroll do container <main> pra encolher a barra de abas (só os
  // botões) quando o usuário rola — a superfície de vidro full-bleed some.
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const onScroll = () => setScrolled(main.scrollTop > 8)
    main.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => main.removeEventListener('scroll', onScroll)
  }, [])
  // Fecha o menu de 3 pontinhos ao voltar pro topo (barra volta a mostrar as abas).
  useEffect(() => {
    if (!scrolled) setMenuOpen(false)
  }, [scrolled])

  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div className="relative space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
            <LayoutGrid className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Vendas · {currentTab.label}{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              {currentTab.subtitle}
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* Tabs — congeladas no topo. Sem scroll: barra de vidro full-bleed.
              Ao rolar: a superfície some e sobra só a pílula dos botões flutuando
              (vidro próprio). O wrapper deixa de capturar cliques quando encolhe. */}
          <div
            className={cn(
              'sticky top-0 z-20 -mx-4 -mt-5 px-4 pb-3 pt-5 transition-all duration-200 md:-mx-6 md:-mt-7 md:px-6 md:pt-7',
              scrolled
                ? 'pointer-events-none'
                : 'border-b border-gray-200/50 bg-white/50 shadow-sm backdrop-blur-lg dark:border-gray-800/50 dark:bg-gray-950/40',
            )}
          >
            {scrolled ? (
              /* Ao rolar: botão compacto com a aba atual + 3 pontinhos → dropdown */
              <div className="pointer-events-auto relative w-fit">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Abrir menu de abas"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200/60 bg-white/70 text-gray-700 shadow-lg shadow-black/5 ring-1 ring-black/5 backdrop-blur-md transition-colors hover:bg-white/90 dark:border-gray-700/60 dark:bg-gray-900/70 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-gray-900/90"
                >
                  <Menu className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <>
                    {/* Backdrop pra fechar ao clicar fora */}
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMenuOpen(false)} />
                    <div
                      role="menu"
                      className="absolute left-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-200/70 bg-white/90 p-1 shadow-xl ring-1 ring-black/5 backdrop-blur-md dark:border-gray-700/60 dark:bg-gray-900/90 dark:ring-white/10"
                    >
                      {TABS.map((tab) => {
                        const isActive = activeTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              handleSetTab(tab.id)
                              setMenuOpen(false)
                            }}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-[#1e3a5f] text-white dark:bg-blue-700'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                            )}
                          >
                            <tab.Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{tab.label}</span>
                            {isActive && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* No topo: todas as abas */
              <div className="pointer-events-auto flex w-fit flex-wrap items-center gap-1">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSetTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                          : 'text-gray-500 hover:bg-white/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200',
                      )}
                    >
                      <tab.Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tab content (embedded) */}
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'visao' && <VisaoGeral embedded />}
            {activeTab === 'combustivel' && <Combustivel embedded />}
            {activeTab === 'pista' && <Pista embedded />}
            {activeTab === 'conveniencia' && <Conveniencia embedded />}
          </Suspense>
        </>
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
