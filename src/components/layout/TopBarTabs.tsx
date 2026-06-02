import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TopBarTab {
  id: string
  label: string
  Icon?: ComponentType<{ className?: string }>
  /** Badge opcional ao lado do label (ex.: contagem de vencidos). */
  badge?: ReactNode
  title?: string
  /** Aba visível mas inativa (cinza, sem clique) — ex.: não se aplica ao modo atual. */
  disabled?: boolean
}

interface TopBarTabsProps {
  tabs: TopBarTab[]
  active: string
  onChange: (id: string) => void
  className?: string
}

/**
 * Abas compactas da TopBar — padrão único dos módulos multi-aba (Vendas,
 * Inteligência, Fechamentos, Caixas & Turnos, etc.). Segmento navy pra aba
 * ativa, dentro de um container `bg-gray-50` arredondado. Pensado pra ficar ao
 * lado do título curto no <PageHeaderTitle>, não numa barra separada.
 */
const TopBarTabs = ({ tabs, active, onChange, className }: TopBarTabsProps) => (
  <div
    className={cn(
      'flex items-center gap-0.5 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]',
      className,
    )}
  >
    {tabs.map((t) => {
      const isActive = active === t.id
      return (
        <button
          key={t.id}
          type="button"
          disabled={t.disabled}
          onClick={() => { if (!t.disabled) onChange(t.id) }}
          title={t.title}
          className={cn(
            'flex h-7 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-xs font-medium transition-all',
            t.disabled
              ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
              : isActive
                ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
          )}
        >
          {t.Icon && <t.Icon className="h-3.5 w-3.5" />}
          {t.label}
          {t.badge}
        </button>
      )
    })}
  </div>
)

export default TopBarTabs
