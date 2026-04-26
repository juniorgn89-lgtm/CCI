import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import Sidebar, { navItems } from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ErrorBoundary from '@/components/feedback/ErrorBoundary'
import LoadingOverlay from '@/components/feedback/LoadingOverlay'
import TopLoader from '@/components/feedback/TopLoader'
import useModulePrefetch from '@/hooks/useModulePrefetch'
import useAlertGenerator from '@/hooks/useAlertGenerator'

const getInitialCollapsed = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 1280
}

const AppLayout = () => {
  useModulePrefetch()
  useAlertGenerator()
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)

  // Always redirect to dashboard on page refresh (initial mount)
  useEffect(() => {
    if (pathname !== '/dashboard') {
      navigate('/dashboard', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)')
    const handler = (e: MediaQueryListEvent) => setCollapsed(!e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-52 border-r border-gray-100 bg-white p-0 dark:border-gray-800 dark:bg-[#1e3a5f]">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="flex h-16 items-center px-4">
            <span className="text-lg font-bold tracking-wide text-gray-900 dark:text-white">CCISGA</span>
          </div>
          <nav aria-label="Menu principal" className="mt-2 space-y-1 px-2">
            {navItems.map((item) => {
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
        <TopLoader />
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
