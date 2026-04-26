import { create } from 'zustand'

export type AlertSeverity = 'danger' | 'warning' | 'info'
export type AlertCategory = 'estoque' | 'financeiro' | 'combustivel' | 'bombas'

export interface AppAlert {
  id: string
  category: AlertCategory
  severity: AlertSeverity
  title: string
  description: string
  timestamp: number
  read: boolean
}

interface NotificationState {
  alerts: AppAlert[]
  setAlerts: (alerts: AppAlert[]) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  unreadCount: number
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  alerts: [],
  unreadCount: 0,

  setAlerts: (newAlerts) => {
    const existing = get().alerts
    // Preserve read state for alerts that already existed
    const readMap = new Map<string, boolean>()
    for (const alert of existing) {
      readMap.set(alert.id, alert.read)
    }

    const merged = newAlerts.map((alert) => ({
      ...alert,
      read: readMap.get(alert.id) ?? false,
    }))

    set({
      alerts: merged,
      unreadCount: merged.filter((a) => !a.read).length,
    })
  },

  markAsRead: (id) => {
    const alerts = get().alerts.map((a) =>
      a.id === id ? { ...a, read: true } : a
    )
    set({
      alerts,
      unreadCount: alerts.filter((a) => !a.read).length,
    })
  },

  markAllAsRead: () => {
    const alerts = get().alerts.map((a) => ({ ...a, read: true }))
    set({ alerts, unreadCount: 0 })
  },
}))
