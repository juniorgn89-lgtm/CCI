import { useLocation, Link, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { Fuel, Trophy, Wallet, LogOut, User, Radio, Sun, Moon, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFreentistaStore } from '@/store/frentista'
import { useThemeStore } from '@/store/theme'

const navItems = [
  { label: 'Abastecimentos', path: '/frentista', icon: Fuel },
  { label: 'Ranking', path: '/frentista/ranking', icon: Trophy },
  { label: 'Caixa', path: '/frentista/caixa', icon: Wallet },
  { label: 'Sangria', path: '/frentista/sangria', icon: Banknote },
]

const FreentistaLayout = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { session, clearSession } = useFreentistaStore()
  const { dark, toggle } = useThemeStore()
  const isFetching = useIsFetching()

  // Default to light mode for frentista
  useEffect(() => {
    if (dark) toggle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = () => {
    sessionStorage.removeItem('app_authenticated')
    sessionStorage.removeItem('app_mode')
    clearSession()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top header */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <User className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{session?.nome ?? 'Frentista'}</p>
              <p className="text-[10px] text-gray-400">{session?.empresaNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-1 dark:bg-green-900/20">
              <Radio className={cn('h-3 w-3 text-green-500', isFetching > 0 && 'animate-pulse')} />
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Tempo real</span>
            </div>
            <button
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              aria-label={dark ? 'Modo claro' : 'Modo escuro'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
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
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-green-600 dark:text-green-400')} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default FreentistaLayout
