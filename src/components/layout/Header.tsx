import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, Menu, Moon, RefreshCw, Sun } from 'lucide-react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useThemeStore } from '@/store/theme'
import { navItems } from '@/components/layout/Sidebar'
import GlobalFilterBar from '@/components/filters/GlobalFilterBar'
import NotificationBell from '@/components/layout/NotificationBell'

interface HeaderProps {
  onMobileMenuOpen: () => void
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'Atualizado agora'
  if (diffMin === 1) return 'Atualizado há 1 min'
  if (diffMin < 60) return `Atualizado há ${diffMin} min`

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `Último: ${hours}:${minutes}`
}

const Header = ({ onMobileMenuOpen }: HeaderProps) => {
  const { pathname } = useLocation()
  const { logout } = useAuth()
  const { dark, toggle } = useThemeStore()
  const queryClient = useQueryClient()
  const isFetching = useIsFetching()

  const [lastRefreshLabel, setLastRefreshLabel] = useState('Atualizado agora')
  const lastRefreshTime = useRef(new Date())
  const wasFetching = useRef(false)

  // Track when fetching transitions from true -> false to update the timestamp
  useEffect(() => {
    if (isFetching > 0) {
      wasFetching.current = true
    } else if (wasFetching.current) {
      wasFetching.current = false
      lastRefreshTime.current = new Date()
      setLastRefreshLabel('Atualizado agora')
    }
  }, [isFetching])

  // Update the relative time label every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefreshLabel(formatRelativeTime(lastRefreshTime.current))
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  const currentModule = navItems.find((item) => item.path === pathname)
  const title = currentModule?.label ?? 'CCISGA'

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuOpen}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <GlobalFilterBar />
          </div>
          <button
            onClick={handleRefresh}
            title={lastRefreshLabel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Atualizar dados"
          >
            <RefreshCw
              className={`h-4 w-4${isFetching > 0 ? ' animate-spin' : ''}`}
            />
          </button>
          <NotificationBell />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label={dark ? 'Modo claro' : 'Modo escuro'}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <LogOut className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>

      {/* Filters on separate row for medium screens */}
      <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-700 lg:hidden">
        <GlobalFilterBar />
      </div>
    </header>
  )
}

export default Header
