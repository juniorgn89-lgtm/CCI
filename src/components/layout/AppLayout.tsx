import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import Sidebar from '@/components/layout/Sidebar'
import { navItems } from '@/components/layout/navConfig'
import { useFocusMode } from '@/store/focusMode'
import Header from '@/components/layout/Header'
import ErrorBoundary from '@/components/feedback/ErrorBoundary'
import LoadingOverlay from '@/components/feedback/LoadingOverlay'
import useModulePrefetch from '@/hooks/useModulePrefetch'
import useAlertGenerator from '@/hooks/useAlertGenerator'
import useAutoSelectSinglePosto from '@/hooks/useAutoSelectSinglePosto'
import useFiltersUrlSync from '@/hooks/useFiltersUrlSync'
import { PAGE_HEADER_ACTIONS_SLOT_ID } from '@/components/layout/PageHeaderActions'
import { PAGE_HEADER_TITLE_SLOT_ID } from '@/components/layout/PageHeaderTitle'
import { useAuthStore } from '@/store/auth'
import WelcomeModal from '@/components/onboarding/WelcomeModal'
import { useTenantStore } from '@/store/tenant'
import { MODULOS, isPathAllowed, firstAllowedPath } from '@/lib/modulos'
import { showsGlobalFilters } from '@/lib/globalFilters'
import GlobalFilterControls from '@/components/filters/GlobalFilterControls'
import TopBar from '@/components/layout/TopBar'
import useIsMobile from '@/hooks/useIsMobile'
import MobileShell from '@/components/mobile/MobileShell'
import { useTopbarUi } from '@/store/topbarUi'

/**
 * Rotas safe pra master sem rede conectada — não dependem da CHAVE Quality.
 * Tudo fora dessa lista força o redirect pra /selecionar-rede.
 */
const isSafeWithoutRede = (path: string): boolean =>
  path === '/selecionar-rede'
  || path.startsWith('/admin/')
  || path === '/configuracoes'

const moduloIdByPath = new Map(MODULOS.map((m) => [m.path, m.id]))

const AppLayout = () => {
  useModulePrefetch()
  useAlertGenerator()
  useAutoSelectSinglePosto()
  useFiltersUrlSync()
  const [mobileOpen, setMobileOpen] = useState(false)
  // Sombra reforçada na TopBar quando o conteúdo já rolou (feedback de "fixo").
  const [scrolled, setScrolled] = useState(false)
  const focusActive = useFocusMode((s) => s.active)
  const setFocus = useFocusMode((s) => s.set)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)

  const showFilters = showsGlobalFilters(pathname)
  const isMobile = useIsMobile()
  // Período alterado e não aplicado → embaça o conteúdo (a TopBar com o botão
  // Visualizar fica nítida, virando o foco da tela).
  const filterDirty = useTopbarUi((s) => s.filterDirty)

  // ESC sai do modo foco (UX padrão pra reading mode).
  useEffect(() => {
    if (!focusActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focusActive, setFocus])

  // O Modo Foco PERSISTE ao trocar de módulo — o hambúrguer do Header (visível
  // no foco) deixa o usuário navegar entre módulos sem sair do foco. Pra sair:
  // ESC, o botão Modo Foco, ou sair do fullscreen nativo.

  // Sincroniza o modo foco com o fullscreen nativo do browser.
  // Entrar: requestFullscreen (precisa de gesto do usuário — o click no botão
  // já conta). Sair: exitFullscreen. Falhas viram no-op (silencioso).
  useEffect(() => {
    if (focusActive) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => { /* user gesture pode ter expirado */ })
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => { /* noop */ })
      }
    }
  }, [focusActive])

  // Se o user sair do fullscreen via F11 / ESC nativo / dropdown do browser,
  // espelhamos no estado pra UI ficar consistente.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFocus(false)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [setFocus])

  const isMaster = useAuthStore((s) => s.isMaster)
  const modulosPermitidos = useAuthStore((s) => s.modulosPermitidos)
  const authUser = useAuthStore((s) => s.user)
  const authFullName = useAuthStore((s) => s.fullName)
  // Tour de boas-vindas (1ª vez por usuário) — overlay em portal, vale nas 2 shells.
  const welcomeModal = authUser ? (
    <WelcomeModal key={authUser.id} userName={authFullName} />
  ) : null
  const tenantRede = useTenantStore((s) => s.rede)

  // Redireciona pra primeira rota permitida no mount inicial. Antes era sempre
  // /dashboard, mas usuário restrito pode não ter acesso a dashboard.
  // Para master sem rede, o guard reativo abaixo cuida de levar pra /selecionar-rede.
  useEffect(() => {
    if (isMaster && !tenantRede) return
    const target = firstAllowedPath(modulosPermitidos, isMaster)
    if (pathname !== target) {
      navigate(target, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guard reativo: master sem rede só pode estar em rotas "safe" (picker, admin,
  // configurações). Qualquer outra → manda pro picker. Toda vez que pathname
  // ou tenantRede mudam, o guard reavalia.
  useEffect(() => {
    if (!isMaster || tenantRede) return
    if (isSafeWithoutRede(pathname)) return
    navigate('/selecionar-rede', { replace: true })
  }, [isMaster, tenantRede, pathname, navigate])

  // Route guard: bloqueia URL direta a módulo não liberado. Rotas fora do
  // catálogo (Configurações, /admin/*) passam livre.
  useEffect(() => {
    if (!isPathAllowed(pathname, modulosPermitidos, isMaster)) {
      navigate(firstAllowedPath(modulosPermitidos, isMaster), { replace: true })
    }
  }, [pathname, modulosPermitidos, isMaster, navigate])

  // Itens visíveis no menu mobile: master vê tudo (inclusive masterOnly);
  // não-master perde masterOnly e módulos fora da lista permitida.
  const visibleNavItems = (() => {
    if (isMaster) return navItems
    let items = navItems.filter((item) => !item.masterOnly)
    if (modulosPermitidos && modulosPermitidos.length > 0) {
      items = items.filter((item) => {
        const id = moduloIdByPath.get(item.path)
        if (!id) return true
        return modulosPermitidos.includes(id)
      })
    }
    return items
  })()

  // Scroll to top on route change (e reseta a sombra da TopBar).
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
    setScrolled(false)
  }, [pathname])

  // Shell MOBILE (<768px): header navy + bottom-nav + sheet de filtros, no lugar
  // da sidebar/TopBar do desktop. Reusa os mesmos guards/efeitos (rodam acima) e
  // renderiza o MESMO <Outlet> — as telas mobile-específicas entram por fase.
  if (isMobile) {
    return (
      <MobileShell items={visibleNavItems} showFilters={showFilters}>
        {welcomeModal}
        <LoadingOverlay />
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </MobileShell>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-950">
      {welcomeModal}
      {/* Barra de topo de largura total — logo+nome na ponta esquerda (fixos,
          fora do menu que recolhe, estilo Gmail) + rede/posto + cluster direito. */}
      <Header onMobileMenuOpen={() => setMobileOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — escondida quando o Modo Foco está ativo. */}
        {!focusActive && <Sidebar />}

        {/* Mobile sidebar (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-52 border-r border-gray-100 bg-white p-0 dark:border-gray-800 dark:bg-[#1e3a5f]">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <div className="flex h-16 items-center px-4">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                aria-label="Página inicial"
                className="text-lg font-bold tracking-wide text-gray-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-300"
              >
                Visor360
              </Link>
            </div>
            <nav aria-label="Menu principal" className="mt-2 space-y-1 px-2">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.path
                const Icon = item.icon

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-l-4 border-[#2563eb] bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white'
                        : 'border-l-4 border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Painel de conteúdo — cantos arredondados sobre o fundo cinza do shell
            (estilo Gmail). TopBar + main vivem dentro dele. */}
        <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900 md:m-2 md:rounded-2xl">
          {/* TopBar consolidada — título (slot-portal por página) + cluster único de
              filtros. Fica fixa no topo (irmã do <main> que rola). O período
              (DateRangeToolbar) chega via slot-portal que cada página preenche. */}
          {showFilters && (
            <TopBar
              scrolled={scrolled}
              title={<div id={PAGE_HEADER_TITLE_SLOT_ID} className="flex min-w-0 flex-1 items-center" />}
              actions={
                <GlobalFilterControls
                  dateSlot={<div id={PAGE_HEADER_ACTIONS_SLOT_ID} className="flex items-center" />}
                />
              }
            />
          )}

          <main
            ref={mainRef}
            role="main"
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
            className={cn(
              'flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-5',
              filterDirty && 'pointer-events-none select-none opacity-50 blur-[2px] transition-all',
            )}
          >
            <LoadingOverlay />
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}

export default AppLayout
