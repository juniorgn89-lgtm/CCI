import { useState, useMemo, useCallback, useEffect } from 'react'
import { AlertTriangle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import ExportButton from '@/components/tables/ExportButton'
import type { AlertItem } from '@/pages/Estoques/hooks/useStockData'

export type SeverityFilter = 'all' | 'danger' | 'warning' | 'caution'

interface StockAlertsProps {
  alerts: AlertItem[]
  initialFilter?: SeverityFilter
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
    badgeActive: 'bg-red-600 text-white dark:bg-red-500',
  },
  warning: {
    label: 'Estoque crítico',
    icon: AlertTriangle,
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-200 dark:border-orange-800',
    iconColor: 'text-orange-500',
    textColor: 'text-orange-700 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
    badgeActive: 'bg-orange-600 text-white dark:bg-orange-500',
  },
  caution: {
    label: 'Estoque baixo',
    icon: AlertCircle,
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    badgeActive: 'bg-amber-600 text-white dark:bg-amber-500',
  },
} as const

const MAX_VISIBLE = 8

const csvColumns: ExportColumn<AlertItem>[] = [
  { header: 'Produto', accessor: (r) => r.produtoNome },
  { header: 'Código', accessor: (r) => r.produtoCodigo },
  { header: 'Categoria', accessor: (r) => r.categoria },
  { header: 'Local', accessor: (r) => r.local },
  { header: 'Saldo', accessor: (r) => r.saldo },
  { header: 'Severidade', accessor: (r) => r.severity },
]

const StockAlerts = ({ alerts, initialFilter = 'all' }: StockAlertsProps) => {
  const [expanded, setExpanded] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(initialFilter)

  useEffect(() => {
    setSeverityFilter(initialFilter)
    setExpanded(false)
  }, [initialFilter])

  const dangerCount = useMemo(() => alerts.filter((a) => a.severity === 'danger').length, [alerts])
  const warningCount = useMemo(() => alerts.filter((a) => a.severity === 'warning').length, [alerts])
  const cautionCount = useMemo(() => alerts.filter((a) => a.severity === 'caution').length, [alerts])

  const filtered = useMemo(() => {
    if (severityFilter === 'all') return alerts
    return alerts.filter((a) => a.severity === severityFilter)
  }, [alerts, severityFilter])

  const handleFilterClick = (filter: SeverityFilter) => {
    setSeverityFilter((prev) => (prev === filter ? 'all' : filter))
    setExpanded(false)
  }

  const handleExport = useCallback(() => {
    exportToCsv('estoque-alertas', filtered, csvColumns)
  }, [filtered])

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

  const visible = expanded ? filtered : filtered.slice(0, MAX_VISIBLE)
  const hasMore = filtered.length > MAX_VISIBLE

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alertas de Estoque</h3>
          {severityFilter !== 'all' && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({filtered.length} de {alerts.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onExport={handleExport} />
          {dangerCount > 0 && (
            <button
              type="button"
              onClick={() => handleFilterClick('danger')}
              className={cn(
                'cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-all hover:scale-105',
                severityFilter === 'danger' ? SEVERITY_CONFIG.danger.badgeActive : SEVERITY_CONFIG.danger.badge
              )}
            >
              {dangerCount} sem estoque
            </button>
          )}
          {warningCount > 0 && (
            <button
              type="button"
              onClick={() => handleFilterClick('warning')}
              className={cn(
                'cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-all hover:scale-105',
                severityFilter === 'warning' ? SEVERITY_CONFIG.warning.badgeActive : SEVERITY_CONFIG.warning.badge
              )}
            >
              {warningCount} crítico
            </button>
          )}
          {cautionCount > 0 && (
            <button
              type="button"
              onClick={() => handleFilterClick('caution')}
              className={cn(
                'cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-all hover:scale-105',
                severityFilter === 'caution' ? SEVERITY_CONFIG.caution.badgeActive : SEVERITY_CONFIG.caution.badge
              )}
            >
              {cautionCount} baixo
            </button>
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
                Ver mais {filtered.length - MAX_VISIBLE} alertas <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default StockAlerts
