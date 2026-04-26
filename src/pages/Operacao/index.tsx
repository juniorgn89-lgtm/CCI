import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Fuel, Gauge, Wallet, BarChart3, Activity, Settings } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { cn } from '@/lib/utils'
import { useOperacaoLayout } from '@/store/moduleLayout'
import OperacaoIndicadores from '@/pages/Operacao/components/OperacaoIndicadores'
import ControleBombas from '@/pages/Operacao/components/ControleBombas'
import RegistroAbastecimentos from '@/pages/Operacao/components/RegistroAbastecimentos'
import CaixaPosto from '@/pages/Operacao/components/CaixaPosto'
import ProdutividadeTab from '@/pages/Operacao/components/ProdutividadeTab'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Fuel> = {
  indicadores: Activity,
  bombas: Gauge,
  abastecimentos: Fuel,
  caixa: Wallet,
  produtividade: BarChart3,
}

const Operacao = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useOperacaoLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
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
    turnoGroups,
    caixaResumo,
    pagamentoBreakdown,
    apuradoPorDia,
    combustiveisList,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()

  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Fuel className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Operação do Posto</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Bombas, abastecimentos, turnos, caixa e produtividade
            </p>
          </div>
        </div>
        <ModuleSettings title="Operação" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </div>

      {/* Empty state */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
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
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
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
                <>
                  {activeTab === 'indicadores' && kpis && (
                    <OperacaoIndicadores
                      kpis={kpis}
                      frentistaRows={frentistaRows}
                      abastecimentoRows={abastecimentoRows}
                      caixaResumo={caixaResumo}
                      onNavigateTab={setActiveTab}
                    />
                  )}
                  {activeTab === 'bombas' && (
                    <ControleBombas bombaRows={bombaRows} bombaRowsPrev={bombaRowsPrev} />
                  )}
                  {activeTab === 'abastecimentos' && (
                    <RegistroAbastecimentos
                      abastecimentoRows={abastecimentoRows}
                      combustiveisList={combustiveisList}
                    />
                  )}
                  {activeTab === 'caixa' && (
                    <CaixaPosto
                      caixaResumo={caixaResumo}
                      pagamentoBreakdown={pagamentoBreakdown}
                      turnoGroups={turnoGroups}
                      apuradoPorDia={apuradoPorDia}
                    />
                  )}
                  {activeTab === 'produtividade' && (
                    <ProdutividadeTab
                      frentistaRows={frentistaRows}
                      frentistaRowsPrev={frentistaRowsPrev}
                      abastecimentoRows={abastecimentoRows}
                      isLoading={isLoading}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Operacao
