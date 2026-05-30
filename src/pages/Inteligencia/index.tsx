import { lazy, Suspense, useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Sparkles,
  Radar,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import { cn } from '@/lib/utils'
import useNetworkData from './hooks/useNetworkData'
import usePostoComparativo from './hooks/usePostoComparativo'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import CompanyPicker from './components/CompanyPicker'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBar from '@/components/layout/TopBar'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import GlobalFilterControls from '@/components/filters/GlobalFilterControls'

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
const AssistenteInteligente = lazy(() => import('./components/AssistenteInteligente'))
const RadarPrecos = lazy(() => import('./components/RadarPrecos'))
const RadarComparativo = lazy(() => import('./components/RadarComparativo'))

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

type TabKey = 'comparativo' | 'comparacao' | 'radarcomp' | 'mapa' | 'analise' | 'metas' | 'previsao' | 'controle' | 'fechamento'
type TopTab = 'analise' | 'radar' | 'assistente'

const multiTabs: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: 'controle', label: 'Centro de Controle', icon: Activity },
  { key: 'fechamento', label: 'Fechamento', icon: Wallet },
  { key: 'comparacao', label: 'Comparação', icon: GitCompareArrows },
  { key: 'radarcomp', label: 'Radar de Preços', icon: Radar },
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
  // Aba controlada pela URL (?tab=) — deep link do menu/atalhos e do flyout de
  // sub-opções da sidebar. 'analise' é o default (sem ?tab=).
  const [searchParams, setSearchParams] = useSearchParams()
  const isTopTab = (v: string | null): v is TopTab =>
    v === 'analise' || v === 'radar' || v === 'assistente'
  const queryTab = searchParams.get('tab')
  const [topTab, setTopTab] = useState<TopTab>(isTopTab(queryTab) ? queryTab : 'analise')

  // Sync state quando o ?tab= muda por fora (flyout da sidebar, deep link).
  const [prevQueryTab, setPrevQueryTab] = useState(queryTab)
  if (queryTab !== prevQueryTab) {
    setPrevQueryTab(queryTab)
    const next: TopTab = isTopTab(queryTab) ? queryTab : 'analise'
    if (next !== topTab) setTopTab(next)
  }

  // Troca de aba via clique → reflete no ?tab= (pra deep-link e voltar do browser).
  const handleSetTopTab = (tab: TopTab) => {
    setTopTab(tab)
    const next = new URLSearchParams(searchParams)
    if (tab === 'analise') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }
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

  const TOP_TABS: { key: TopTab; label: string; short: string; icon: typeof Brain; desc: string }[] = [
    { key: 'analise', label: 'Análise & Comparação', short: 'Análise', icon: GitCompareArrows, desc: 'KPIs, comparativos, mapa e previsões' },
    { key: 'radar', label: 'Radar de Preços', short: 'Radar', icon: Radar, desc: 'Guerra de preço — margem, elasticidade e simulação até o fechamento' },
    { key: 'assistente', label: 'Cadu IA', short: 'Cadu IA', icon: Sparkles, desc: 'Copiloto de IA para perguntas em linguagem natural' },
  ]

  return (
    <div className="space-y-3">
      {/* MESMA TopBar das demais telas (título à esquerda + nav, filtros à
          direita). Sticky full-bleed porque a Inteligência não usa a sub-bar
          global do AppLayout (showsGlobalFilters = false). */}
      <TopBar
        className="sticky -top-4 z-30 -mx-4 -mt-4 md:-top-5 md:-mx-6 md:-mt-5"
        title={
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
            {/* Bloco de título idêntico ao <PageHeaderTitle> das outras telas */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Inteligência da Rede
              </h1>
              <FocusModeToggle />
            </div>

            {/* Nav (labels curtos) */}
            <div className="flex items-center gap-0.5 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
              {TOP_TABS.map((t) => {
                const Icon = t.icon
                const isActive = topTab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => handleSetTopTab(t.key)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-xs font-medium transition-all',
                      isActive
                        ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-gray-100'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                    )}
                    title={t.desc}
                  >
                    <Icon className={cn('h-3.5 w-3.5', isActive && t.key === 'assistente' && 'text-purple-500')} />
                    {t.short}
                  </button>
                )
              })}
            </div>
          </div>
        }
        actions={
          topTab === 'radar'
            ? <GlobalFilterControls dateSlot={<DateRangeToolbar />} />
            : undefined
        }
      />

      {topTab === 'radar' && (
        <Suspense fallback={<TabFallback />}>
          <RadarPrecos />
        </Suspense>
      )}

      {/* Assistente IA — global, não exige selecionar posto (usa filtro global) */}
      {topTab === 'assistente' && (
        <Suspense fallback={<TabFallback />}>
          <AssistenteInteligente />
        </Suspense>
      )}

      {/* Análise & Comparação — picker + sub-tabs gated por hasEmpresa */}
      {topTab === 'analise' && (
        <>
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
              {/* Sub-tabs de análise */}
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

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
                  {activeTab === 'comparativo' && isSingle && comparativo && (
                    <PostoComparativo data={comparativo} />
                  )}
                  {activeTab === 'controle' && (
                    <ControlCenter postos={postos} networkTotals={networkTotals} alerts={alerts} />
                  )}
                  {activeTab === 'comparacao' && !isSingle && (
                    <PostoComparison postos={postos} networkAvg={networkAvg} />
                  )}
                  {activeTab === 'radarcomp' && !isSingle && (
                    <RadarComparativo postos={postos} networkAvg={networkAvg} />
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
        </>
      )}
    </div>
  )
}

export default Inteligencia
