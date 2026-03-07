import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import Sidebar, { navItems } from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import TopLoader from '@/components/feedback/TopLoader'

const getInitialCollapsed = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 1280
}

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)')
    const handler = (e: MediaQueryListEvent) => setCollapsed(!e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <TopLoader />
      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-[#1e3a5f] p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="flex h-16 items-center px-4">
            <span className="text-lg font-bold tracking-wide text-white">CCISGA</span>
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
                      ? 'border-l-4 border-[#2563eb] bg-white/10 text-white'
                      : 'border-l-4 border-transparent text-white/70 hover:bg-white/10 hover:text-white'
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
          role="main"
          className="flex-1 overflow-y-auto p-4 md:p-6"
          onClick={() => { if (!collapsed) setCollapsed(true) }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
