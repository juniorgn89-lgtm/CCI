import { Link, useLocation } from 'react-router-dom'
import { Fuel, Wrench, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  Icon: typeof Fuel
}

const items: NavItem[] = [
  { to: '/comercial/vendas/combustivel', label: 'Combustível', Icon: Fuel },
  { to: '/comercial/vendas/pista', label: 'Automotivo', Icon: Wrench },
  { to: '/comercial/vendas/conveniencia', label: 'Conveniência', Icon: Store },
]

/**
 * Switcher entre as abas de Comercial · Vendas — Combustível, Pista e
 * Conveniência. Mesma estética do OperacaoNav.
 */
const VendasNav = () => {
  const { pathname } = useLocation()

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
      {items.map((item) => {
        const isActive = pathname === item.to
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
              isActive
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
            )}
          >
            <item.Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

export default VendasNav
