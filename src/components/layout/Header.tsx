import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, RefreshCw } from 'lucide-react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { navItems } from '@/components/layout/Sidebar'
import GlobalFilterBar from '@/components/filters/GlobalFilterBar'
import NotificationBell from '@/components/layout/NotificationBell'
import RedeSwitcher from '@/components/layout/RedeSwitcher'

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
  const queryClient = useQueryClient()
  const isFetching = useIsFetching()

  const [lastRefreshLabel, setLastRefreshLabel] = useState('Atualizado agora')
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const lastRefreshTime = useRef(new Date())

  // Track when manual refresh completes
  useEffect(() => {
    if (manualRefreshing && isFetching === 0) {
      setManualRefreshing(false)
      lastRefreshTime.current = new Date()
      setLastRefreshLabel('Atualizado agora')
    }
  }, [manualRefreshing, isFetching])

  // Update the relative time label every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefreshLabel(formatRelativeTime(lastRefreshTime.current))
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setManualRefreshing(true)
    queryClient.invalidateQueries()
  }

  const currentModule = navItems.find((item) => item.path === pathname)
  const title = currentModule?.label ?? 'CCISGA'

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuOpen}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="hidden text-base font-semibold text-gray-900 dark:text-gray-100 xl:block">{title}</h1>
          <RedeSwitcher />
        </div>

        <div className="flex items-center gap-2">
          {pathname !== '/inteligencia' && (
            <div className="hidden xl:block">
              <GlobalFilterBar />
            </div>
          )}
          <button
            onClick={handleRefresh}
            title={lastRefreshLabel}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
              isFetching > 0
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4${isFetching > 0 ? ' animate-spin' : ''}`} />
          </button>
          <NotificationBell />
        </div>
      </div>

      {/* Filters row — always visible below xl, inline above (hidden on Inteligência) */}
      {pathname !== '/inteligencia' && (
        <div className="border-t border-gray-100 px-4 py-1.5 dark:border-gray-700 xl:hidden">
          <GlobalFilterBar />
        </div>
      )}
    </header>
  )
}

export default Header
