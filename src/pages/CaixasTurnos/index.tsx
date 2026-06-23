import { lazy, Suspense } from 'react'
import useTabParam from '@/hooks/useTabParam'
import { LayoutDashboard, ClipboardCheck, Receipt, Scale } from 'lucide-react'
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
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import CaixasMobile from '@/pages/CaixasTurnos/CaixasMobile'

const ConferenciaPdv = lazy(() => import('@/pages/Operacao/components/ConferenciaPdv'))
const CaixaGeralReport = lazy(() => import('@/pages/CaixasTurnos/components/CaixaGeralReport'))
const DiferencasCaixa = lazy(() => import('@/pages/CaixasTurnos/components/DiferencasCaixa'))

type CaixaTab = 'visao' | 'conferencia' | 'diferencas'
const isCaixaTab = (v: string | null): v is CaixaTab =>
  v === 'visao' || v === 'conferencia' || v === 'diferencas'

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
    isLoading,
    hasEmpresa,
  } = useOperacaoData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const [caixaTab, setCaixaTab] = useTabParam<CaixaTab>('visao', isCaixaTab)
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useCaixasLayout()
  const isMobile = useIsMobile()

  // Ícone por aba — o resto (ordem/visibilidade) vem do store de layout.
  const TAB_META: Record<string, { Icon: typeof LayoutDashboard }> = {
    visao: { Icon: LayoutDashboard },
    conferencia: { Icon: ClipboardCheck },
    diferencas: { Icon: Scale },
  }
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Se a aba ativa foi ocultada, cai pra primeira visível.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === caixaTab)) {
    setCaixaTab(visibleTabs[0].id as CaixaTab)
  }

  // Mobile: tela própria (abas Visão Geral + Turnos), reusa o mesmo hook.
  if (isMobile) return <CaixasMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <Receipt className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">Fechamento de Caixa</h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Conferência de caixas e turnos
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      {hasEmpresa && visibleTabs.length > 0 && (
        <PageHeaderTitle>
          <TopBarTabs
            active={caixaTab}
            onChange={(id) => setCaixaTab(id as CaixaTab)}
            tabs={visibleTabs.map((t) => ({
              id: t.id,
              label: t.label,
              Icon: TAB_META[t.id]?.Icon ?? LayoutDashboard,
            }))}
          />
        </PageHeaderTitle>
      )}
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
            {caixaTab === 'conferencia' ? (
              <ConferenciaPdv />
            ) : caixaTab === 'diferencas' ? (
              <DiferencasCaixa />
            ) : (
              <CaixaGeralReport />
            )}
          </Suspense>
        )
      )}
    </div>
  )
}

export default CaixasTurnos
