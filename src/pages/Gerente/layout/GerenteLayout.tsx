import { useEffect } from 'react'
import { useLocation, Link, Outlet, useNavigate } from 'react-router-dom'
import { useIsFetching } from '@tanstack/react-query'
import { LayoutDashboard, Users, BarChart3, LogOut, Radio, Fuel, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { useThemeStore } from '@/store/theme'

const navItems = [
  { label: 'Início', path: '/gerente', icon: LayoutDashboard },
  { label: 'Financeiro', path: '/gerente/financeiro', icon: DollarSign },
  { label: 'Frentistas', path: '/gerente/frentistas', icon: Users },
  { label: 'Combustíveis', path: '/gerente/combustiveis', icon: Fuel },
]

const GerenteLayout = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isFetching = useIsFetching()
  const { setPeriodo } = useFilterStore()
  const { dark, toggle } = useThemeStore()

  useEffect(() => {
    const now = new Date()
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today = fmt(now)
    setPeriodo(today, today)
    if (!dark) toggle()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = () => {
    sessionStorage.removeItem('app_authenticated')
    sessionStorage.removeItem('app_mode')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top header */}
      <header className="shrink-0 border-b border-[#1e3a5f]/20 bg-[#1e3a5f] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Painel Gerente</p>
              <p className="text-[10px] text-blue-200/70">Visão mobile</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1">
              <Radio className={cn('h-3 w-3 text-green-400', isFetching > 0 && 'animate-pulse')} />
              <span className="text-[10px] font-medium text-green-300">Tempo real</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-1 transition-colors',
                  isActive
                    ? 'text-[#1e3a5f] dark:text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-[#1e3a5f] dark:text-blue-400')} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default GerenteLayout
