import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCheck,
  Package,
  DollarSign,
  Fuel,
  Wrench,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useNotificationStore, type AppAlert, type AlertSeverity, type AlertCategory } from '@/store/notifications'

/* ── Config maps ─────────────────────────────────────── */

const severityConfig: Record<AlertSeverity, {
  icon: typeof AlertTriangle
  iconClass: string
  border: string
}> = {
  danger: {
    icon: AlertCircle,
    iconClass: 'text-red-500',
    border: 'border-l-red-500',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    border: 'border-l-amber-500',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-500',
    border: 'border-l-blue-500',
  },
}

const categoryConfig: Record<AlertCategory, {
  label: string
  icon: typeof Package
  route: string
  color: string
}> = {
  estoque: {
    label: 'Estoque',
    icon: Package,
    route: '/estoques',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  },
  financeiro: {
    label: 'Financeiro',
    icon: DollarSign,
    route: '/financeiro',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  combustivel: {
    label: 'Combustivel',
    icon: Fuel,
    route: '/combustiveis',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
  },
  bombas: {
    label: 'Bombas',
    icon: Wrench,
    route: '/operacao?tab=bombas',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
}

/* ── Time formatting ─────────────────────────────────── */

const formatTimeAgo = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) return 'agora'
  if (diffMinutes < 60) return `${diffMinutes}min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

/* ── Alert item ──────────────────────────────────────── */

interface AlertItemProps {
  alert: AppAlert
  onRead: (id: string) => void
  onNavigate: (route: string) => void
}

const AlertItem = ({ alert, onRead, onNavigate }: AlertItemProps) => {
  const severity = severityConfig[alert.severity]
  const category = categoryConfig[alert.category]
  const Icon = severity.icon

  const handleClick = () => {
    onRead(alert.id)
    onNavigate(category.route)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg border-l-[3px] px-3 py-3 text-left transition-all',
        'hover:bg-gray-50 dark:hover:bg-gray-800/60',
        severity.border,
        alert.read ? 'opacity-60' : 'bg-white dark:bg-gray-900/50'
      )}
    >
      <div className={cn(
        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        alert.severity === 'danger' ? 'bg-red-50 dark:bg-red-950/40' :
        alert.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40' :
        'bg-blue-50 dark:bg-blue-950/40'
      )}>
        <Icon className={cn('h-3.5 w-3.5', severity.iconClass)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm leading-snug',
            alert.read
              ? 'font-normal text-gray-500 dark:text-gray-400'
              : 'font-semibold text-gray-900 dark:text-gray-100'
          )}>
            {alert.title}
          </p>
          <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
            {formatTimeAgo(alert.timestamp)}
          </span>
        </div>

        <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {alert.description}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
            category.color
          )}>
            <category.icon className="h-2.5 w-2.5" />
            {category.label}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500">
            Ver modulo
            <ChevronRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>

      {!alert.read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </button>
  )
}

/* ── Main component ──────────────────────────────────── */

const NotificationBell = () => {
  const [open, setOpen] = useState(false)
  const { alerts, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  const navigate = useNavigate()

  const handleNavigate = (route: string) => {
    setOpen(false)
    navigate(route)
  }

  const dangerCount = alerts.filter((a) => !a.read && a.severity === 'danger').length
  const warningCount = alerts.filter((a) => !a.read && a.severity === 'warning').length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label={`Alertas${unreadCount > 0 ? ` (${unreadCount} nao lidos)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
              dangerCount > 0 ? 'bg-red-500' : 'bg-amber-500'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[400px] max-h-[480px] overflow-hidden p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Alertas
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {unreadCount} novo{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-1.5">
              {dangerCount > 0 && (
                <span className="flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle className="h-2.5 w-2.5" />
                  {dangerCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {warningCount}
                </span>
              )}
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />

        {/* Alert list */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <Bell className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nenhum alerta
              </p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                Tudo certo por enquanto
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onRead={markAsRead}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {alerts.length > 0 && unreadCount > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-2">
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
