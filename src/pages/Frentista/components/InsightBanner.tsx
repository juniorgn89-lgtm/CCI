import { Sparkles, TrendingUp, Trophy, Target, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type InsightType = 'success' | 'motivate' | 'warning' | 'champion' | 'tip'

interface InsightBannerProps {
  type: InsightType
  message: string
}

const config: Record<InsightType, { icon: typeof Sparkles; accent: string; bg: string; text: string; iconColor: string }> = {
  success: {
    icon: TrendingUp,
    accent: 'border-l-4 border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-800 dark:text-green-300',
    iconColor: 'text-green-500',
  },
  motivate: {
    icon: Zap,
    accent: 'border-l-4 border-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-800 dark:text-blue-300',
    iconColor: 'text-blue-500',
  },
  warning: {
    icon: Target,
    accent: 'border-l-4 border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-800 dark:text-red-300',
    iconColor: 'text-red-500',
  },
  champion: {
    icon: Trophy,
    accent: 'border-l-4 border-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-900 dark:text-amber-200',
    iconColor: 'text-amber-500',
  },
  tip: {
    icon: Shield,
    accent: 'border-l-4 border-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-800 dark:text-violet-300',
    iconColor: 'text-violet-500',
  },
}

const InsightBanner = ({ type, message }: InsightBannerProps) => {
  const c = config[type]
  const Icon = c.icon

  return (
    <div className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2.5', c.accent, c.bg)}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/70 dark:bg-gray-800/50">
        <Icon className={cn('h-4 w-4', c.iconColor)} />
      </div>
      <p className={cn('text-xs font-medium leading-relaxed', c.text)}>{message}</p>
    </div>
  )
}

export default InsightBanner
