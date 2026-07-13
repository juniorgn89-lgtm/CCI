import { lazy, Suspense, useEffect, useState } from 'react'
import { Activity, Layers, Fuel, Wrench, Store, Tag } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import { useTopbarUi } from '@/store/topbarUi'
import ProjecoesPainel from '@/pages/Dashboard/components/ProjecoesPainel'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import useIsMobile from '@/hooks/useIsMobile'
import CentralMobile from '@/pages/Dashboard/CentralMobile'
import { isPastPeriod } from '@/lib/utils'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import TopBarTabs from '@/components/layout/TopBarTabs'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { useDashboardLayout } from '@/store/moduleLayout'

// Lazy: TurnosAoVivo (cards live) só carrega quando a aba é aberta.
const TurnosAoVivo = lazy(() => import('@/pages/Dashboard/components/TurnosAoVivo'))
const BenchmarkSetor = lazy(() => import('@/pages/Dashboard/components/BenchmarkSetor'))
// Abas de Vendas (por-posto) movidas pra Central — renderizadas `embedded`
// (pulam header/SelectCompanyState/nav próprios). Arquivos seguem em Comercial/Vendas.
const Combustivel = lazy(() => import('@/pages/Comercial/Vendas/Combustivel'))
const Pista = lazy(() => import('@/pages/Comercial/Vendas/Pista'))
const Conveniencia = lazy(() => import('@/pages/Comercial/Vendas/Conveniencia'))
const GestaoPrecos = lazy(() => import('@/pages/Dashboard/components/GestaoPrecos'))

type TabId = 'setor' | 'aovivo' | 'combustivel' | 'pista' | 'conveniencia' | 'precos'

// Combustível, Pista e Conveniência agora são CONSOLIDADOS (cache apuracao_vendas)
// → renderizam rede-wide sempre, respeitando o filtro de posto. Nenhuma aba pede
// mais a seleção de um posto único (o gate SelectCompanyState foi removido).

const TAB_ICONS: Record<TabId, typeof Activity> = {
  setor: Layers,
  aovivo: Activity,
  combustivel: Fuel,
  pista: Wrench,
  conveniencia: Store,
  precos: Tag,
}

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
  const isMobile = useIsMobile()

  // Quando o período inteiro já passou, esconde elementos "ao vivo" — não
  // existe turno aberto em mês passado, só ruído visual.
  const periodIsPast = isPastPeriod(dataFinal)

  // Layout das abas (Visão Geral / Ao Vivo Rede). Engrenagem no HeaderTray
  // permite reordenar/ocultar; o contexto (periodIsPast) esconde "Ao Vivo Rede"
  // quando não faz sentido (período inteiro no passado).
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useDashboardLayout()
  const knownTabs = layoutTabs.filter((t) => {
    if (t.id === 'aovivo' && periodIsPast) return false
    return true
  })
  const visibleTabs = knownTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) — permite deep-link das sub-opções da sidebar
  // (Visão Geral / Ao Vivo Rede). 'setor' é o default (sem ?tab=).
  const [activeTab, setActiveTab] = useTabParam<TabId>(
    'setor',
    (v): v is TabId =>
      v === 'setor' || v === 'aovivo' || v === 'combustivel' || v === 'pista' || v === 'conveniencia' || v === 'precos',
  )
  // Painel de Projeção aberto → oculta o "Detalhamento por setor" abaixo.
  const [projExpanded, setProjExpanded] = useState(false)
  // Set-state durante render quando a aba persistida foi escondida via engrenagem.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0].id as TabId)
  }

  // Aba "Ao Vivo Rede" = tela ao vivo → desabilita os filtros de período/escopo/
  // comparativo (não fazem sentido no agora). Limpa ao sair.
  const setLiveLock = useTopbarUi((s) => s.setLiveLock)
  useEffect(() => {
    setLiveLock(activeTab === 'aovivo')
    return () => setLiveLock(false)
  }, [activeTab, setLiveLock])

  // Mobile: tela própria (KPIs + projeção + setores + ranking), no shell mobile.
  if (isMobile) return <CentralMobile />

  return (
    <div className="space-y-4">
      <>
          {/* Título + Modo Foco vêm do ModuleHeaderChrome global (via rota). */}
          {/* Abas continuam na TopBar (slot esquerdo padrão). */}
          {visibleTabs.length > 0 && (
            <PageHeaderTitle>
              <TopBarTabs
                active={activeTab}
                onChange={(id) => setActiveTab(id as TabId)}
                tabs={visibleTabs.map((t) => ({
                  id: t.id,
                  label: t.label,
                  Icon: TAB_ICONS[t.id as TabId] ?? Activity,
                }))}
              />
            </PageHeaderTitle>
          )}
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

          {/* Cards de segmento rede-wide (Combustível, Automotivos, Conveniência,
              Global, Projeção) — só na "Visão Geral". As abas ao vivo e as de
              vendas por-posto têm seus próprios painéis/projeções. */}
          {activeTab === 'setor' && <ProjecoesPainel onExpandedChange={setProjExpanded} />}

          {/* Conteúdo da aba ativa (abas no header, padrão TopBarTabs). Todas as
              abas de vendas são consolidadas (cache) → renderizam rede-wide. */}
          {visibleTabs.length > 0 && (
            <Suspense fallback={<TabSkeleton />}>
              {activeTab === 'setor' && !projExpanded && (
                <div style={{ animation: 'chartIn .35s cubic-bezier(.4,0,.2,1) both' }}>
                  <BenchmarkSetor />
                </div>
              )}
              {activeTab === 'aovivo' && <TurnosAoVivo />}
              {activeTab === 'combustivel' && <Combustivel embedded />}
              {activeTab === 'pista' && <Pista embedded />}
              {activeTab === 'conveniencia' && <Conveniencia embedded />}
              {activeTab === 'precos' && <GestaoPrecos />}
            </Suspense>
          )}
        </>
    </div>
  )
}

export default Dashboard
