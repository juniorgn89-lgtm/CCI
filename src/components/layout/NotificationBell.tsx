import { useState } from 'react'
import { Bell, AlertTriangle, AlertCircle, Info, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useNotificationStore, type AppAlert, type AlertSeverity } from '@/store/notifications'

const severityConfig: Record<AlertSeverity, {
  icon: typeof AlertTriangle
  iconClass: string
  bgClass: string
  darkBgClass: string
}> = {
  danger: {
    icon: AlertCircle,
    iconClass: 'text-red-500',
    bgClass: 'bg-red-50',
    darkBgClass: 'dark:bg-red-950/30',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-50',
    darkBgClass: 'dark:bg-amber-950/30',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-500',
    bgClass: 'bg-blue-50',
    darkBgClass: 'dark:bg-blue-950/30',
  },
}

const formatTimeAgo = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) return 'agora'
  if (diffMinutes < 60) return `${diffMinutes}min atrás`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h atrás`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d atrás`
}

interface AlertItemProps {
  alert: AppAlert
  onRead: (id: string) => void
}

const AlertItem = ({ alert, onRead }: AlertItemProps) => {
  const config = severityConfig[alert.severity]
  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={() => onRead(alert.id)}
      className={cn(
        'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800',
        !alert.read && `${config.bgClass} ${config.darkBgClass}`
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn(
            'text-sm truncate',
            alert.read
              ? 'font-normal text-gray-600 dark:text-gray-400'
              : 'font-medium text-gray-900 dark:text-gray-100'
          )}>
            {alert.title}
          </p>
          <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
            {formatTimeAgo(alert.timestamp)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {alert.description}
        </p>
      </div>
      {!alert.read && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </button>
  )
}

const NotificationBell = () => {
  const [open, setOpen] = useState(false)
  const { alerts, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label={`Alertas${unreadCount > 0 ? ` (${unreadCount} não lidos)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[420px] overflow-hidden p-0"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Alertas
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {unreadCount} novo{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[320px] overflow-y-auto p-1">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum alerta no momento
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} onRead={markAsRead} />
              ))}
            </div>
          )}
        </div>

        {alerts.length > 0 && unreadCount > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-1">
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
