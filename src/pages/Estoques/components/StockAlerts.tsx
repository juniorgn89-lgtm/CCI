import { useState } from 'react'
import { AlertTriangle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { AlertItem } from '@/pages/Estoques/hooks/useStockData'

interface StockAlertsProps {
  alerts: AlertItem[]
}

const SEVERITY_CONFIG = {
  danger: {
    label: 'Sem estoque',
    icon: XCircle,
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500',
    textColor: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  },
  warning: {
    label: 'Estoque crítico',
    icon: AlertTriangle,
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-200 dark:border-orange-800',
    iconColor: 'text-orange-500',
    textColor: 'text-orange-700 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
  },
  caution: {
    label: 'Estoque baixo',
    icon: AlertCircle,
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  },
} as const

const MAX_VISIBLE = 8

const StockAlerts = ({ alerts }: StockAlertsProps) => {
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Estoque saudável</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Todos os produtos estão com estoque dentro do esperado.</p>
          </div>
        </div>
      </div>
    )
  }

  // Group by severity
  const dangerItems = alerts.filter((a) => a.severity === 'danger')
  const warningItems = alerts.filter((a) => a.severity === 'warning')
  const cautionItems = alerts.filter((a) => a.severity === 'caution')

  const visible = expanded ? alerts : alerts.slice(0, MAX_VISIBLE)
  const hasMore = alerts.length > MAX_VISIBLE

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alertas de Estoque</h3>
        </div>
        <div className="flex items-center gap-2">
          {dangerItems.length > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_CONFIG.danger.badge)}>
              {dangerItems.length} sem estoque
            </span>
          )}
          {warningItems.length > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_CONFIG.warning.badge)}>
              {warningItems.length} crítico
            </span>
          )}
          {cautionItems.length > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEVERITY_CONFIG.caution.badge)}>
              {cautionItems.length} baixo
            </span>
          )}
        </div>
      </div>

      {/* Alert items */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {visible.map((item, i) => {
          const cfg = SEVERITY_CONFIG[item.severity]
          const Icon = cfg.icon
          return (
            <div
              key={`${item.produtoCodigo}-${item.local}-${i}`}
              className={cn('flex items-center gap-3 px-4 py-3 transition-colors', cfg.bg)}
            >
              <Icon className={cn('h-4 w-4 shrink-0', cfg.iconColor)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.produtoNome}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.categoria} · {item.local}
                </p>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-bold tabular-nums', cfg.textColor)}>
                  {formatNumber(item.saldo)}
                </p>
                <p className={cn('text-xs', cfg.textColor)}>{cfg.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-center gap-1 py-2.5 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {expanded ? (
              <>
                Mostrar menos <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Ver mais {alerts.length - MAX_VISIBLE} alertas <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default StockAlerts
