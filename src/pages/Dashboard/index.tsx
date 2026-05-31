import { lazy, Suspense, useState } from 'react'
import { LayoutDashboard, Activity, Fuel, Layers } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import ProjecoesPainel from '@/pages/Dashboard/components/ProjecoesPainel'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import { useAuthStore } from '@/store/auth'
import { isPastPeriod } from '@/lib/utils'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import TopBarTabs from '@/components/layout/TopBarTabs'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { useDashboardLayout } from '@/store/moduleLayout'

// Lazy: TurnosAoVivo (cards live) e ReabastecimentoCard (recharts/lógica de
// tanques) só carregam quando a aba é aberta.
const TurnosAoVivo = lazy(() => import('@/pages/Dashboard/components/TurnosAoVivo'))
const ReabastecimentoCard = lazy(() => import('@/pages/Dashboard/components/ReabastecimentoCard'))
const BenchmarkSetor = lazy(() => import('@/pages/Dashboard/components/BenchmarkSetor'))

type TabId = 'setor' | 'aovivo' | 'reabastecimento'

const TAB_ICONS: Record<TabId, typeof Activity> = {
  setor: Layers,
  aovivo: Activity,
  reabastecimento: Fuel,
}

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 [mask-image:linear-gradient(to_bottom,black_calc(100%-14px),transparent_100%)]">
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Dashboard = () => {
  const { dataFinal } = useFilterStore()
  useDashboardData() // dispara prefetch (cache de apuração + dependências)
  const canVerReabastecimento = useAuthStore((s) => s.canVerReabastecimento)

  // Quando o período inteiro já passou, esconde elementos "ao vivo" — não
  // existe turno aberto em mês passado, só ruído visual.
  const periodIsPast = isPastPeriod(dataFinal)

  // Layout das abas (Ao Vivo Rede / Reabastecimento). Engrenagem no HeaderTray
  // permite reordenar/ocultar; permissão (canVerReabastecimento) e contexto
  // (periodIsPast) escondem abas que não fazem sentido naquele estado.
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useDashboardLayout()
  const knownTabs = layoutTabs.filter((t) => {
    if (t.id === 'aovivo' && periodIsPast) return false
    if (t.id === 'reabastecimento' && !canVerReabastecimento) return false
    return true
  })
  const visibleTabs = knownTabs.filter((t) => t.visible)
  const [activeTab, setActiveTab] = useState<TabId>((visibleTabs[0]?.id ?? 'setor') as TabId)
  // Set-state durante render quando a aba persistida foi escondida via engrenagem.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0].id as TabId)
  }

  return (
    <div className="space-y-4">
      <>
          <PageHeaderTitle>
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
                  <LayoutDashboard className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">Central da Rede</h1>
                    <FocusModeToggle />
                  </div>
                  <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {periodIsPast
                      ? 'Resumo consolidado do período selecionado'
                      : 'Acompanhamento dos postos em tempo real'}
                  </p>
                </div>
              </div>
              {visibleTabs.length > 0 && (
                <TopBarTabs
                  active={activeTab}
                  onChange={(id) => setActiveTab(id as TabId)}
                  tabs={visibleTabs.map((t) => ({
                    id: t.id,
                    label: t.label,
                    Icon: TAB_ICONS[t.id as TabId] ?? Activity,
                  }))}
                />
              )}
            </div>
          </PageHeaderTitle>
          <PageHeaderActions>
            <DateRangeToolbar />
          </PageHeaderActions>
          {knownTabs.length > 0 && (
            <HeaderTray>
              <ModuleSettings
                title="Central da Rede"
                tabs={knownTabs}
                toggleVisibility={toggleVisibility}
                moveUp={moveUp}
                moveDown={moveDown}
                reset={reset}
              />
            </HeaderTray>
          )}

          {/* Cards de segmento sempre visíveis (Combustível, Automotivos, Conveniência, Global, Projeção). */}
          <ProjecoesPainel />

          {/* Conteúdo da aba ativa (abas no header, padrão TopBarTabs) */}
          {visibleTabs.length > 0 && (
            <Suspense fallback={<TabSkeleton />}>
              {activeTab === 'setor' && <BenchmarkSetor />}
              {activeTab === 'aovivo' && <TurnosAoVivo />}
              {activeTab === 'reabastecimento' && <ReabastecimentoCard />}
            </Suspense>
          )}
        </>
    </div>
  )
}

export default Dashboard
