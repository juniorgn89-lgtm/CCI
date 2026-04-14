import { useLocation, Link } from 'react-router-dom'
import {
  BarChart3,
  Fuel,
  Package,
  Store,
  Warehouse,
  DollarSign,
  Brain,
  Gauge,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
      { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
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

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { pathname } = useLocation()

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-[#1e3a5f] text-white transition-all duration-300 dark:bg-gray-900',
        collapsed ? 'w-16 overflow-visible' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <span className="text-lg font-bold tracking-wide">CCISGA</span>
        )}
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav aria-label="Menu principal" className="flex-1 px-2 pb-4">
        {navGroups.map((group, gi) => (
          <div key={group.title} className={cn(gi > 0 && 'mt-4')}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {group.title}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 mb-2 border-t border-white/10" />
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
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-blue-400')} />
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
    </aside>
  )
}

export { navItems }
export default Sidebar
