import { lazy, Suspense, useCallback, useState } from 'react'
import {
  Brain,
  GitCompareArrows,
  Map,
  Lightbulb,
  Target,
  TrendingUp,
  Activity,
  CalendarDays,
  Wallet,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import { cn } from '@/lib/utils'
import useNetworkData from './hooks/useNetworkData'
import usePostoComparativo from './hooks/usePostoComparativo'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import CompanyPicker from './components/CompanyPicker'

// Conteúdo das abas em chunks separados: recharts (Comparação/Previsão) e
// leaflet (Mapa, ~154 kB) só baixam quando a aba é aberta.
const PostoComparison = lazy(() => import('./components/PostoComparison'))
const PostoComparativo = lazy(() => import('./components/PostoComparativo'))
const NetworkMap = lazy(() => import('./components/NetworkMap'))
const SmartAnalysis = lazy(() => import('./components/SmartAnalysis'))
const PostoGoals = lazy(() => import('./components/PostoGoals'))
const SalesForecast = lazy(() => import('./components/SalesForecast'))
const ControlCenter = lazy(() => import('./components/ControlCenter'))
const FechamentoConsolidado = lazy(() => import('./components/FechamentoConsolidado'))

const TabFallback = () => (
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
)

type TabKey = 'comparativo' | 'comparacao' | 'mapa' | 'analise' | 'metas' | 'previsao' | 'controle' | 'fechamento'

const multiTabs: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: 'controle', label: 'Centro de Controle', icon: Activity },
  { key: 'fechamento', label: 'Fechamento', icon: Wallet },
  { key: 'comparacao', label: 'Comparação', icon: GitCompareArrows },
  { key: 'mapa', label: 'Mapa da Rede', icon: Map },
  { key: 'analise', label: 'Análise Inteligente', icon: Lightbulb },
  { key: 'metas', label: 'Metas', icon: Target },
  { key: 'previsao', label: 'Previsão', icon: TrendingUp },
]

const singleTabs: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: 'comparativo', label: 'Comparativo', icon: CalendarDays },
  { key: 'controle', label: 'Centro de Controle', icon: Activity },
  { key: 'fechamento', label: 'Fechamento', icon: Wallet },
  { key: 'analise', label: 'Análise Inteligente', icon: Lightbulb },
  { key: 'metas', label: 'Metas', icon: Target },
  { key: 'previsao', label: 'Previsão', icon: TrendingUp },
]

const Inteligencia = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('comparativo')
  const [selectedEmpresas, setSelectedEmpresas] = useState<number[]>([])

  const handleCompare = useCallback((codigos: number[]) => {
    setSelectedEmpresas(codigos)
    // Auto-select appropriate tab
    if (codigos.length === 1) {
      setActiveTab('comparativo')
    } else if (codigos.length > 1) {
      setActiveTab('controle')
    }
  }, [])

  const isSingle = selectedEmpresas.length === 1
  const tabs = isSingle ? singleTabs : multiTabs

  const {
    postos,
    networkAvg,
    networkTotals,
    insights,
    goals,
    forecastData,
    alerts,
    isLoading,
  } = useNetworkData({ empresaCodigos: selectedEmpresas })

  const { comparativo } = usePostoComparativo(isSingle ? selectedEmpresas[0] : null)

  const hasEmpresa = selectedEmpresas.length > 0
  const showSkeleton = useShowSkeleton(isLoading, !!postos)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Inteligência da Rede
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isSingle
                ? 'Análise temporal e comparativo de desempenho'
                : 'Análise estratégica e comparação de desempenho entre postos'}
            </p>
          </div>
        </div>
      </div>

      {/* Multi-company picker */}
      <CompanyPicker selected={selectedEmpresas} onCompare={handleCompare} />

      {!hasEmpresa ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <GitCompareArrows className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Selecione os postos acima para iniciar a análise
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            1 posto = comparativo temporal &middot; 2+ postos = comparação entre postos
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
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
          {showSkeleton ? (
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
            <Suspense fallback={<TabFallback />}>
              {/* Single posto: temporal comparison */}
              {activeTab === 'comparativo' && isSingle && comparativo && (
                <PostoComparativo data={comparativo} />
              )}

              {/* Multi posto tabs */}
              {activeTab === 'controle' && (
                <ControlCenter postos={postos} networkTotals={networkTotals} alerts={alerts} />
              )}
              {activeTab === 'comparacao' && !isSingle && (
                <PostoComparison postos={postos} networkAvg={networkAvg} />
              )}
              {activeTab === 'mapa' && !isSingle && <NetworkMap postos={postos} />}
              {activeTab === 'fechamento' && <FechamentoConsolidado postos={postos} />}
              {activeTab === 'analise' && <SmartAnalysis insights={insights} />}
              {activeTab === 'metas' && <PostoGoals goals={goals} />}
              {activeTab === 'previsao' && <SalesForecast forecastData={forecastData} />}
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}

export default Inteligencia
