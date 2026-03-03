export const COLORS = {
  primary: '#1e3a5f',
  accent: '#2563eb',
  background: '#ffffff',
  backgroundSecondary: '#f9fafb',
  border: '#e5e7eb',
  positive: '#22c55e',
  negative: '#ef4444',
  warning: '#f59e0b',
  text: '#111827',
  textSecondary: '#6b7280',
  tableHeader: '#f3f4f6',
} as const

export const CHART_COLORS = [
  '#1e3a5f',
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',
] as const

export const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1280,
} as const

export const STALE_TIMES = {
  default: 5 * 60 * 1000,
  empresas: 10 * 60 * 1000,
  static: 30 * 60 * 1000,
} as const
