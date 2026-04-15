import { Sparkles, TrendingUp, Trophy, Target, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type InsightType = 'success' | 'motivate' | 'warning' | 'champion' | 'tip'

interface InsightBannerProps {
  type: InsightType
  message: string
}

const config: Record<InsightType, { icon: typeof Sparkles; bg: string; border: string; text: string; iconColor: string }> = {
  success: {
    icon: TrendingUp,
    bg: 'bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
    text: 'text-emerald-800 dark:text-emerald-300',
    iconColor: 'text-emerald-500',
  },
  motivate: {
    icon: Zap,
    bg: 'bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20',
    border: 'border-blue-200/60 dark:border-blue-800/40',
    text: 'text-blue-800 dark:text-blue-300',
    iconColor: 'text-blue-500',
  },
  warning: {
    icon: Target,
    bg: 'bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20',
    border: 'border-amber-200/60 dark:border-amber-800/40',
    text: 'text-amber-800 dark:text-amber-300',
    iconColor: 'text-amber-500',
  },
  champion: {
    icon: Trophy,
    bg: 'bg-gradient-to-r from-amber-50 to-yellow-50/50 dark:from-amber-950/30 dark:to-yellow-950/20',
    border: 'border-amber-300/60 dark:border-amber-700/40',
    text: 'text-amber-900 dark:text-amber-200',
    iconColor: 'text-amber-500',
  },
  tip: {
    icon: Shield,
    bg: 'bg-gradient-to-r from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20',
    border: 'border-violet-200/60 dark:border-violet-800/40',
    text: 'text-violet-800 dark:text-violet-300',
    iconColor: 'text-violet-500',
  },
}

const InsightBanner = ({ type, message }: InsightBannerProps) => {
  const c = config[type]
  const Icon = c.icon

  return (
    <div className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2', c.bg, c.border)}>
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/70 dark:bg-gray-800/50')}>
        <Icon className={cn('h-4 w-4', c.iconColor)} />
      </div>
      <p className={cn('text-xs font-medium leading-relaxed', c.text)}>{message}</p>
    </div>
  )
}

export default InsightBanner
