import { useState } from 'react'
import { Fuel, Gauge, Clock, Wallet, BarChart3 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { cn } from '@/lib/utils'
import OperacaoKpis from '@/pages/Operacao/components/OperacaoKpis'
import ControleBombas from '@/pages/Operacao/components/ControleBombas'
import RegistroAbastecimentos from '@/pages/Operacao/components/RegistroAbastecimentos'
import TurnosTrabalho from '@/pages/Operacao/components/TurnosTrabalho'
import CaixaPosto from '@/pages/Operacao/components/CaixaPosto'
import ProdutividadeTab from '@/pages/Operacao/components/ProdutividadeTab'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useProductivityData from '@/pages/Operacao/hooks/useProductivityData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

type TabKey = 'bombas' | 'abastecimentos' | 'turnos' | 'caixa' | 'produtividade'

const tabs: { key: TabKey; label: string; icon: typeof Fuel }[] = [
  { key: 'bombas', label: 'Bombas', icon: Gauge },
  { key: 'abastecimentos', label: 'Abastecimentos', icon: Fuel },
  { key: 'turnos', label: 'Turnos', icon: Clock },
  { key: 'caixa', label: 'Caixa', icon: Wallet },
  { key: 'produtividade', label: 'Produtividade', icon: BarChart3 },
]


const ContentSkeleton = () => (
  <div className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  </div>
)

const Operacao = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('bombas')
  const {
    kpis,
    frentistaRows,
    bombaRows,
    abastecimentoRows,
    turnoRows,
    caixaResumo,
    pagamentoBreakdown,
    frentistasList,
    combustiveisList,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()

  const {
    conversionRanking,
    isLoading: prodLoading,
  } = useProductivityData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
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
      </div>

      {/* Empty state */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs */}
          {showSkeleton ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : kpis ? (
            <OperacaoKpis kpis={kpis} onNavigateTab={setActiveTab} />
          ) : null}

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                    activeTab === tab.key
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
            <ContentSkeleton />
          ) : (
            <>
              {activeTab === 'bombas' && (
                <ControleBombas bombaRows={bombaRows} />
              )}
              {activeTab === 'abastecimentos' && (
                <RegistroAbastecimentos
                  abastecimentoRows={abastecimentoRows}
                  frentistasList={frentistasList}
                  combustiveisList={combustiveisList}
                />
              )}
              {activeTab === 'turnos' && (
                <TurnosTrabalho turnoRows={turnoRows} />
              )}
              {activeTab === 'caixa' && (
                <CaixaPosto
                  caixaResumo={caixaResumo}
                  pagamentoBreakdown={pagamentoBreakdown}
                  turnoRows={turnoRows}
                />
              )}
              {activeTab === 'produtividade' && (
                <ProdutividadeTab
                  frentistaRows={frentistaRows}
                  abastecimentoRows={abastecimentoRows}
                  conversionRanking={conversionRanking}
                  isLoading={prodLoading}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Operacao
