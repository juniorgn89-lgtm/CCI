import { useLocation } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { navItems } from '@/components/layout/Sidebar'
import GlobalFilterBar from '@/components/filters/GlobalFilterBar'

interface HeaderProps {
  onMobileMenuOpen: () => void
}

const Header = ({ onMobileMenuOpen }: HeaderProps) => {
  const { pathname } = useLocation()
  const { logout } = useAuth()

  const currentModule = navItems.find((item) => item.path === pathname)
  const title = currentModule?.label ?? 'CCISGA'

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuOpen}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <GlobalFilterBar />
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500 hover:text-gray-700">
            <LogOut className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>

      {/* Filters on separate row for medium screens */}
      <div className="border-t border-gray-100 px-4 py-2 lg:hidden">
        <GlobalFilterBar />
      </div>
    </header>
  )
}

export default Header
