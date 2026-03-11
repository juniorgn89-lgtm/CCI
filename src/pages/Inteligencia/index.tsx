import { useState } from 'react'
import {
  Brain,
  GitCompareArrows,
  Map,
  Lightbulb,
  Target,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import useNetworkData from './hooks/useNetworkData'
import PostoComparison from './components/PostoComparison'
import NetworkMap from './components/NetworkMap'
import SmartAnalysis from './components/SmartAnalysis'
import PostoGoals from './components/PostoGoals'
import SalesForecast from './components/SalesForecast'
import ControlCenter from './components/ControlCenter'

type TabKey = 'comparacao' | 'mapa' | 'analise' | 'metas' | 'previsao' | 'controle'

const tabs: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: 'controle', label: 'Centro de Controle', icon: Activity },
  { key: 'comparacao', label: 'Comparação', icon: GitCompareArrows },
  { key: 'mapa', label: 'Mapa da Rede', icon: Map },
  { key: 'analise', label: 'Análise Inteligente', icon: Lightbulb },
  { key: 'metas', label: 'Metas', icon: Target },
  { key: 'previsao', label: 'Previsão', icon: TrendingUp },
]

const KpiSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-2 h-4 w-20" />
  </div>
)

const Inteligencia = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('controle')
  const { empresaCodigos } = useFilterStore()
  const {
    postos,
    networkAvg,
    networkTotals,
    insights,
    goals,
    forecastData,
    alerts,
    isLoading,
    hasEmpresa,
  } = useNetworkData()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Inteligência da Rede
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Análise estratégica e comparação de desempenho entre postos
            </p>
          </div>
        </div>
      </div>

      {!hasEmpresa ? (
        <SelectCompanyState />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <KpiSkeleton key={i} />
                ))}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'controle' && (
                <ControlCenter postos={postos} networkTotals={networkTotals} alerts={alerts} />
              )}
              {activeTab === 'comparacao' && (
                <PostoComparison postos={postos} networkAvg={networkAvg} />
              )}
              {activeTab === 'mapa' && <NetworkMap postos={postos} />}
              {activeTab === 'analise' && <SmartAnalysis insights={insights} />}
              {activeTab === 'metas' && <PostoGoals goals={goals} />}
              {activeTab === 'previsao' && <SalesForecast forecastData={forecastData} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Inteligencia
