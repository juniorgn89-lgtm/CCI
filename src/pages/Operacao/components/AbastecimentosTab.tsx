import { useState } from 'react'
import { CalendarDays, Fuel, DollarSign } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import Diaria from '@/pages/Operacao/components/abastecimentos/Diaria'
import Tipo from '@/pages/Operacao/components/abastecimentos/Tipo'
import LbLitro from '@/pages/Operacao/components/abastecimentos/LbLitro'

type SubTab = 'diaria' | 'tipo' | 'lblitro'

const subTabs: { key: SubTab; label: string; icon: typeof CalendarDays }[] = [
  { key: 'diaria', label: 'Diária', icon: CalendarDays },
  { key: 'tipo', label: 'Por tipo', icon: Fuel },
  { key: 'lblitro', label: 'L.B./Litro', icon: DollarSign },
]

const AbastSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-32 rounded-xl" />
    <Skeleton className="h-72 rounded-xl" />
  </div>
)

const AbastecimentosTab = () => {
  const [active, setActive] = useState<SubTab>('diaria')
  const { rows, dailyData, fuelTypeData, lbLitroData, combustiveis, projectionMeta, isLoading } = useAbastecimentosAnalytics()

  if (isLoading) return <AbastSkeleton />

  return (
    <div className="space-y-5">
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {subTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-all',
                isActive
                  ? 'border border-gray-200 bg-white font-medium text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
                  : 'border border-transparent bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {active === 'diaria' && <Diaria data={dailyData} rows={rows} combustiveis={combustiveis} projection={projectionMeta} />}
      {active === 'tipo' && <Tipo data={fuelTypeData} projection={projectionMeta} />}
      {active === 'lblitro' && <LbLitro data={lbLitroData} projection={projectionMeta} />}
    </div>
  )
}

export default AbastecimentosTab
