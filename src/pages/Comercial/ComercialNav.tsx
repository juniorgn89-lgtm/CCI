import { Link, useLocation } from 'react-router-dom'
import { LineChart, Fuel, Wrench, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  Icon: typeof Fuel
}

const items: NavItem[] = [
  { to: '/comercial/vendas', label: 'Vendas', Icon: LineChart },
  { to: '/comercial/combustivel', label: 'Combustível', Icon: Fuel },
  { to: '/comercial/pista', label: 'Pista', Icon: Wrench },
  { to: '/comercial/conveniencia', label: 'Conveniência', Icon: Store },
]

/**
 * Switcher entre as abas de Comercial — Vendas (mix), Combustível, Pista,
 * Conveniência. Mesma estética do OperacaoNav.
 */
const ComercialNav = () => {
  const { pathname } = useLocation()

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
      {items.map((item) => {
        const isActive = pathname === item.to
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            <item.Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

export default ComercialNav
