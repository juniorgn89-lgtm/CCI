import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Fuel, Gauge, Wallet, BarChart3, Activity, Settings, Droplets, DollarSign, TrendingUp } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { useOperacaoLayout } from '@/store/moduleLayout'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

// Conteúdo das abas em chunks separados (recharts só baixa quando a aba abre).
// Os KPIs do topo continuam instantâneos.
const OperacaoIndicadores = lazy(() => import('@/pages/Operacao/components/OperacaoIndicadores'))
const ControleBombas = lazy(() => import('@/pages/Operacao/components/ControleBombas'))
const CaixaPosto = lazy(() => import('@/pages/Operacao/components/CaixaPosto'))
const ProdutividadeTab = lazy(() => import('@/pages/Operacao/components/ProdutividadeTab'))

const TAB_ICONS: Record<string, typeof Fuel> = {
  indicadores: Activity,
  bombas: Gauge,
  caixa: Wallet,
  produtividade: BarChart3,
}

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
    {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

const Operacao = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useOperacaoLayout()
  // Defensivo: ignora abas legadas do layout salvo (ex.: "Abastecimentos"
  // promovida pra módulo) sem depender da migração do store rodar primeiro.
  const knownTabs = layoutTabs.filter((t) => t.id in TAB_ICONS)
  const visibleTabs = knownTabs.filter((t) => t.visible)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Aba inicial respeita ?tab=... (vindo de notificações ou deep links)
  const queryTab = searchParams.get('tab')
  const initialTab = queryTab && visibleTabs.some((t) => t.id === queryTab)
    ? queryTab
    : visibleTabs[0]?.id ?? 'indicadores'

  const [activeTab, setActiveTab] = useState(initialTab)

  // Quando o ?tab muda (chegada via notificação enquanto na página), aplica
  useEffect(() => {
    if (queryTab && visibleTabs.some((t) => t.id === queryTab) && queryTab !== activeTab) {
      setActiveTab(queryTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTab])

  // Se aba ativa fica oculta, troca para a primeira visível
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? 'indicadores')
    }
  }, [visibleTabs, activeTab])

  // Limpa o ?tab da URL após aplicar (evita navegar pra mesma aba ao recarregar)
  useEffect(() => {
    if (queryTab) {
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    kpis,
    frentistaRows,
    frentistaRowsPrev,
    bombaRows,
    bombaRowsPrev,
    abastecimentoRows,
    abastecimentoRowsPrev,
    turnoRows,
    turnoGroups,
    caixaResumo,
    pagamentoBreakdown,
    apuradoPorDia,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()
  const empresaNome = useEmpresaNome()

  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  return (
    <div className="space-y-6">
      {/* Header da página — título à esquerda + engrenagem à direita,
          ambos portados pra sub-bar do AppLayout via Portals. Resultado:
          tudo na mesma linha horizontal compartilhada com os filtros. */}
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/30">
            <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Operação{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Bombas, turnos, caixa e produtividade
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <HeaderTray>
        <ModuleSettings title="Operação" tabs={knownTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </HeaderTray>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Empty state */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs principais — sempre visíveis acima das abas */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate('/abastecimentos')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Litros Vendidos</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatLiters(kpis.totalLitros)}
              </p>
              {kpis && <DeltaBadge current={kpis.totalLitros} previous={kpis.prevTotalLitros} />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('caixa')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-green-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Faturamento</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatCurrency(kpis.faturamentoCombustivel)}
              </p>
              {kpis && <DeltaBadge current={kpis.faturamentoCombustivel} previous={kpis.prevFaturamentoCombustivel} />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('caixa')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Apurado</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {showSkeleton || !kpis ? '—' : formatCurrency(kpis.totalApurado)}
              </p>
              {kpis && <DeltaBadge current={kpis.totalApurado} previous={kpis.prevTotalApurado} />}
            </button>
          </div>

          {/* Tabs */}
          {visibleTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
              <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma aba visível. Use o botão <span className="inline-flex align-middle"><Settings className="mx-0.5 inline h-4 w-4" /></span> para personalizar.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
                {visibleTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab.id] ?? Activity
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                        activeTab === tab.id
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                    {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
                  </div>
                </div>
              ) : (
                <Suspense fallback={<TabFallback />}>
                  {activeTab === 'indicadores' && kpis && (
                    <OperacaoIndicadores
                      kpis={kpis}
                      abastecimentoRows={abastecimentoRows}
                      onNavigateTab={setActiveTab}
                    />
                  )}
                  {activeTab === 'bombas' && (
                    <ControleBombas bombaRows={bombaRows} bombaRowsPrev={bombaRowsPrev} />
                  )}
                  {activeTab === 'caixa' && (
                    <CaixaPosto
                      caixaResumo={caixaResumo}
                      pagamentoBreakdown={pagamentoBreakdown}
                      turnoRows={turnoRows}
                      turnoGroups={turnoGroups}
                      apuradoPorDia={apuradoPorDia}
                    />
                  )}
                  {activeTab === 'produtividade' && (
                    <ProdutividadeTab
                      frentistaRows={frentistaRows}
                      frentistaRowsPrev={frentistaRowsPrev}
                      abastecimentoRows={abastecimentoRows}
                      abastecimentoRowsPrev={abastecimentoRowsPrev}
                      isLoading={isLoading}
                    />
                  )}
                </Suspense>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Operacao
