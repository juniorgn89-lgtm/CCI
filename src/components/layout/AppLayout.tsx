import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import Sidebar, { navItems } from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ErrorBoundary from '@/components/feedback/ErrorBoundary'
import LoadingOverlay from '@/components/feedback/LoadingOverlay'
import useModulePrefetch from '@/hooks/useModulePrefetch'
import useAlertGenerator from '@/hooks/useAlertGenerator'
import useAutoSelectSinglePosto from '@/hooks/useAutoSelectSinglePosto'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { MODULOS, isPathAllowed, firstAllowedPath } from '@/lib/modulos'

/**
 * Rotas safe pra master sem rede conectada — não dependem da CHAVE Quality.
 * Tudo fora dessa lista força o redirect pra /selecionar-rede.
 */
const isSafeWithoutRede = (path: string): boolean =>
  path === '/selecionar-rede'
  || path.startsWith('/admin/')
  || path === '/configuracoes'

const SIDEBAR_PREF_KEY = 'sidebar_collapsed'

const readManualPreference = (): boolean | null => {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(SIDEBAR_PREF_KEY)
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}

const getInitialCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false
  // Preferência manual sempre vence o breakpoint automático
  const manual = readManualPreference()
  if (manual !== null) return manual
  return window.innerWidth < 1280
}

const moduloIdByPath = new Map(MODULOS.map((m) => [m.path, m.id]))

const AppLayout = () => {
  useModulePrefetch()
  useAlertGenerator()
  useAutoSelectSinglePosto()
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const [hasManualPref, setHasManualPref] = useState<boolean>(
    () => readManualPreference() !== null
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)

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
  // não-master perde os masterOnly e os módulos fora da lista permitida.
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

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)')
    const handler = (e: MediaQueryListEvent) => {
      // Só aplica o breakpoint automático quando o usuário ainda não fixou preferência manual
      if (!hasManualPref) setCollapsed(!e.matches)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [hasManualPref])

  const handleSidebarToggle = () => {
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(SIDEBAR_PREF_KEY, String(next))
      } catch { /* noop */ }
      return next
    })
    setHasManualPref(true)
  }

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} onToggle={handleSidebarToggle} />

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
              CCISGA
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

        <main
          ref={mainRef}
          role="main"
          className="flex-1 overflow-y-auto p-4 md:p-6"
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
