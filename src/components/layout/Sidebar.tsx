import { useEffect, useRef, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Fuel,
  Package,
  Store,
  Warehouse,
  DollarSign,
  Brain,
  Gauge,
  ChevronRight as ArrowRight,
  PanelLeft,
  Settings,
  LogOut,
  Globe,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  label: string
  path: string
  icon: typeof BarChart3
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Geral',
    items: [
      { label: 'Central da Rede', path: '/dashboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Operacional',
    items: [
      { label: 'Combustíveis', path: '/combustiveis', icon: Fuel },
      { label: 'Operação', path: '/operacao', icon: Gauge },
      { label: 'Conveniências', path: '/conveniencias', icon: Store },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Produtos', path: '/produtos', icon: Package },
      { label: 'Estoques', path: '/estoques', icon: Warehouse },
      { label: 'Financeiro', path: '/financeiro', icon: DollarSign },
    ],
  },
  {
    title: 'Análise',
    items: [
      { label: 'Inteligência', path: '/inteligencia', icon: Brain },
    ],
  },
]

const navItems = navGroups.flatMap((g) => g.items)

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const userName = (import.meta.env.VITE_APP_USER as string) || 'Usuário'
  const userEmail = (import.meta.env.VITE_APP_EMAIL as string) || `${userName}@ccisga.local`
  const initials = getInitials(userName)

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close on Esc
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menuOpen])

  const handleConfiguracoes = () => {
    setMenuOpen(false)
    navigate('/configuracoes')
  }

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
  }

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-gray-100 bg-white text-gray-700 transition-all duration-300 dark:border-gray-800 dark:bg-[#1e3a5f] dark:text-gray-200',
        collapsed ? 'w-16 overflow-visible' : 'w-52'
      )}
    >
      <div className={cn('flex h-16 items-center px-4', collapsed && 'justify-center')}>
        {!collapsed && (
          <span className="text-lg font-bold tracking-wide text-gray-900 dark:text-white">CCISGA</span>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white',
            !collapsed && 'ml-auto',
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Menu principal" className="flex-1 px-2 pb-4">
        {navGroups.map((group, gi) => (
          <div key={group.title} className={cn(gi > 0 && 'mt-4')}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40">
                {group.title}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 mb-2 border-t border-gray-100 dark:border-white/10" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.path
                const Icon = item.icon

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-gray-100 text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
                    )}
                  >
                    <Icon className={cn(
                      'h-[18px] w-[18px] shrink-0',
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 dark:text-white/60'
                    )} />
                    {!collapsed && <span>{item.label}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — perfil + ações */}
      <div className="border-t border-gray-100 px-3 py-3 dark:border-white/10">
        <div ref={menuRef} className="relative">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Conta de ${userName}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {initials}
              </button>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="min-w-0 flex-1 truncate text-left text-sm text-gray-700 hover:text-gray-900 dark:text-white/80 dark:hover:text-white"
                title={userName}
              >
                {userName}
              </button>
              <button
                onClick={handleConfiguracoes}
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Configurações"
                title="Configurações"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={handleLogout}
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Conta de ${userName}`}
                title={userName}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {initials}
              </button>
            </div>
          )}

          {menuOpen && (
            <div
              role="menu"
              className={cn(
                'absolute z-50 w-56 rounded-xl border border-gray-200 bg-white py-1 text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
                collapsed
                  ? 'bottom-0 left-full ml-2'
                  : 'bottom-full left-0 mb-2'
              )}
            >
              {/* Email */}
              <p className="truncate px-3 py-2 text-xs text-gray-400" title={userEmail}>
                {userEmail}
              </p>

              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

              {/* Configurações */}
              <button
                role="menuitem"
                onClick={handleConfiguracoes}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-500" />
                  Configurações
                </span>
                <kbd className="font-mono text-[10px] text-gray-400">⇧+Ctrl+,</kbd>
              </button>

              {/* Idioma */}
              <button
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-500" />
                  Idioma
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>

              {/* Receber ajuda */}
              <button
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <HelpCircle className="h-4 w-4 text-gray-500" />
                Receber ajuda
              </button>

              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

              {/* Sair */}
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LogOut className="h-4 w-4 text-gray-500" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export { navItems }
export default Sidebar
