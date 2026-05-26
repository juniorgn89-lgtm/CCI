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
import { useTenantStore } from '@/store/tenant'
import { MODULOS, isPathAllowed, firstAllowedPath } from '@/lib/modulos'
import { showsGlobalFilters } from '@/lib/globalFilters'

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
  const focusActive = useFocusMode((s) => s.active)
  const setFocus = useFocusMode((s) => s.set)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)

  // ESC sai do modo foco (UX padrão pra reading mode).
  useEffect(() => {
    if (!focusActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focusActive, setFocus])

  // Sair do modo foco automaticamente ao mudar de MÓDULO top-level
  // (Comercial → Operação, etc.). Navegação dentro do mesmo módulo
  // (ex.: tabs do Comercial · Vendas: Visão Geral → Combustível → Pista)
  // preserva o foco — não faz sentido derrubar a cada clique de aba.
  // Fallback: rotas fora do catálogo (admin, configurações) usam o próprio
  // pathname como id, mantendo o comportamento legado.
  const currentModuloId = MODULOS.find(
    (m) => pathname === m.path || pathname.startsWith(m.path + '/'),
  )?.id ?? pathname
  useEffect(() => {
    setFocus(false)
  }, [currentModuloId, setFocus])

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

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
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

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMobileMenuOpen={() => setMobileOpen(true)} />

        {/* Sub-bar — gradient suave do Header pra página com slot do título
            (esquerda) e slot de ações (direita). Os filtros antes globais
            (posto, período, datas) foram movidos: posto subiu pro Header,
            datas viraram filtros locais por tela. */}
        {showsGlobalFilters(pathname) && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50 px-4 pb-3 pt-3 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950 md:px-6 md:pb-4 md:pt-4">
            <div id={PAGE_HEADER_TITLE_SLOT_ID} className="min-w-0 flex-1" />
            <div id={PAGE_HEADER_ACTIONS_SLOT_ID} className="shrink-0" />
          </div>
        )}

        <main
          ref={mainRef}
          role="main"
          className="flex-1 overflow-y-auto px-4 pb-4 pt-5 md:px-6 md:pb-6 md:pt-7"
        >
          <LoadingOverlay />
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
