import { lazy, Suspense } from 'react'
import useTabParam from '@/hooks/useTabParam'
import { Wallet, LayoutDashboard } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { useCaixasLayout } from '@/store/moduleLayout'
import { cn } from '@/lib/utils'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import CaixasMobile from '@/pages/CaixasTurnos/CaixasMobile'

const CaixaPosto = lazy(() => import('@/pages/Operacao/components/CaixaPosto'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/**
 * Página Caixas & Turnos — só header + DateRangeToolbar; KPIs, gráficos e
 * tabelas vivem dentro do CaixaPosto (que tem suas próprias tabs).
 */
const CaixasTurnos = () => {
  const {
    kpis,
    caixaResumo,
    pagamentoBreakdown,
    turnoGroups,
    apuradoPorDia,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const [caixaTab, setCaixaTab] = useTabParam<'visao' | 'turnos'>(
    'visao',
    (v): v is 'visao' | 'turnos' => v === 'visao' || v === 'turnos',
  )
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useCaixasLayout()
  const isMobile = useIsMobile()

  // Ícone/badge por aba — o resto (ordem/visibilidade) vem do store de layout.
  const TAB_META: Record<string, { Icon: typeof Wallet }> = {
    visao: { Icon: LayoutDashboard },
    turnos: { Icon: Wallet },
  }
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Se a aba ativa foi ocultada, cai pra primeira visível.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === caixaTab)) {
    setCaixaTab(visibleTabs[0].id as 'visao' | 'turnos')
  }

  // Mobile: tela própria (abas Visão Geral + Turnos), reusa o mesmo hook.
  if (isMobile) return <CaixasMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Caixas &amp; Turnos</h1>
            <FocusModeToggle />
          </div>
          {hasEmpresa && visibleTabs.length > 0 && (
            <TopBarTabs
              active={caixaTab}
              onChange={(id) => setCaixaTab(id as 'visao' | 'turnos')}
              tabs={visibleTabs.map((t) => ({
                id: t.id,
                label: t.label,
                Icon: TAB_META[t.id]?.Icon ?? Wallet,
                badge: t.id === 'turnos' ? (
                  <span className={cn(
                    'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                    caixaTab === 'turnos'
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                  )}>
                    {turnoGroups.length}
                  </span>
                ) : undefined,
              }))}
            />
          )}
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>
      {hasEmpresa && (
        <HeaderTray>
          <ModuleSettings
            title="Caixas & Turnos"
            tabs={layoutTabs}
            toggleVisibility={toggleVisibility}
            moveUp={moveUp}
            moveDown={moveDown}
            reset={reset}
          />
        </HeaderTray>
      )}

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        showSkeleton ? (
          <TabFallback />
        ) : (
          <Suspense fallback={<TabFallback />}>
            <CaixaPosto
              kpis={kpis}
              caixaResumo={caixaResumo}
              pagamentoBreakdown={pagamentoBreakdown}
              turnoGroups={turnoGroups}
              apuradoPorDia={apuradoPorDia}
              activeTab={caixaTab}
            />
          </Suspense>
        )
      )}
    </div>
  )
}

export default CaixasTurnos
