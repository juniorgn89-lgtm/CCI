import { lazy, Suspense, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, Layers, Fuel, Wrench, Store, Tag } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { Skeleton } from '@/components/ui/skeleton'
import ProjecoesPainel from '@/pages/Dashboard/components/ProjecoesPainel'
import useIsMobile from '@/hooks/useIsMobile'
import CentralMobile from '@/pages/Dashboard/CentralMobile'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import TopBarTabs from '@/components/layout/TopBarTabs'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { useDashboardLayout } from '@/store/moduleLayout'

const BenchmarkSetor = lazy(() => import('@/pages/Dashboard/components/BenchmarkSetor'))
// Abas de Vendas (por-posto) movidas pra Central — renderizadas `embedded`
// (pulam header/SelectCompanyState/nav próprios). Arquivos seguem em Comercial/Vendas.
const Combustivel = lazy(() => import('@/pages/Comercial/Vendas/Combustivel'))
const Pista = lazy(() => import('@/pages/Comercial/Vendas/Pista'))
const Conveniencia = lazy(() => import('@/pages/Comercial/Vendas/Conveniencia'))
const GestaoPrecos = lazy(() => import('@/pages/Dashboard/components/GestaoPrecos'))

type TabId = 'setor' | 'combustivel' | 'pista' | 'conveniencia' | 'precos'

// Combustível, Pista e Conveniência agora são CONSOLIDADOS (cache apuracao_vendas)
// → renderizam rede-wide sempre, respeitando o filtro de posto. Nenhuma aba pede
// mais a seleção de um posto único (o gate SelectCompanyState foi removido).

const TAB_ICONS: Record<TabId, typeof Activity> = {
  setor: Layers,
  combustivel: Fuel,
  pista: Wrench,
  conveniencia: Store,
  precos: Tag,
}

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Dashboard = () => {
  const isMobile = useIsMobile()

  // Layout das abas (engrenagem no HeaderTray permite reordenar/ocultar).
  const { tabs: knownTabs, toggleVisibility, moveUp, moveDown, reset } = useDashboardLayout()
  const visibleTabs = knownTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) — permite deep-link das sub-opções da sidebar.
  // 'setor' é o default (sem ?tab=).
  const [activeTab, setActiveTab] = useTabParam<TabId>(
    'setor',
    (v): v is TabId =>
      v === 'setor' || v === 'combustivel' || v === 'pista' || v === 'conveniencia' || v === 'precos',
  )
  // Set-state durante render quando a aba persistida foi escondida via engrenagem.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0].id as TabId)
  }

  // Ao trocar de aba, a aba anterior desmonta e suas queries ficam SEM
  // observador (inactive). Se ainda estavam buscando (ex.: Combustível live),
  // continuariam rodando em segundo plano: "sujam" o indicador global de
  // "Atualizando…" na aba nova e desperdiçam chamadas na Quality (pioram o
  // rate-limit). Cancelar as inactive resolve os dois — as ativas da aba atual
  // (com observador) não são tocadas.
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.cancelQueries({ type: 'inactive' })
  }, [activeTab, queryClient])

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
          {activeTab === 'setor' && <ProjecoesPainel />}

          {/* Conteúdo da aba ativa (abas no header, padrão TopBarTabs). Todas as
              abas de vendas são consolidadas (cache) → renderizam rede-wide. */}
          {visibleTabs.length > 0 && (
            <Suspense fallback={<TabSkeleton />}>
              {activeTab === 'setor' && (
                <div style={{ animation: 'chartIn .35s cubic-bezier(.4,0,.2,1) both' }}>
                  <BenchmarkSetor />
                </div>
              )}
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
