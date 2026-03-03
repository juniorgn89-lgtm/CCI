import { useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Fuel,
  Package,
  Store,
  Warehouse,
  Users,
  DollarSign,
  FileBarChart,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Combustíveis', path: '/combustiveis', icon: Fuel },
  { label: 'Produtos', path: '/produtos', icon: Package },
  { label: 'Conveniências', path: '/conveniencias', icon: Store },
  { label: 'Estoques', path: '/estoques', icon: Warehouse },
  { label: 'Produtividade', path: '/produtividade', icon: Users },
  { label: 'Financeiro', path: '/financeiro', icon: DollarSign },
  { label: 'Relatórios', path: '/relatorios', icon: FileBarChart },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { pathname } = useLocation()

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-[#1e3a5f] text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
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
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          const Icon = item.icon

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-4 border-[#2563eb] bg-white/10 text-white'
                  : 'border-l-4 border-transparent text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export { navItems }
export default Sidebar
