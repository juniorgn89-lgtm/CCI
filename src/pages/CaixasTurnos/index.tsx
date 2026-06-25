import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import useTabParam from '@/hooks/useTabParam'
import { LayoutDashboard, ClipboardCheck, Receipt, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
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
const FechamentoExcecao = lazy(() => import('@/pages/CaixasTurnos/components/FechamentoExcecao'))

// Módulo consolidado: Fechamento por exceção (landing) + Conferência por PDV.
// Visão Geral (Caixa Geral) e Diferenças foram removidas — a Diferenças virou o
// Panorama dentro da Exceção. ?tab inválido cai no default (excecao).
type CaixaTab = 'excecao' | 'conferencia'
const isCaixaTab = (v: string | null): v is CaixaTab =>
  v === 'excecao' || v === 'conferencia'

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
  // Caixa/turno é por-posto (conferência e fechamento se conciliam por loja).
  // Mostra UM posto por vez, com seletor quando o filtro tem mais de um.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  const {
    kpis,
    isLoading,
    hasEmpresa,
  } = useOperacaoData(selectedCodigo)
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const [caixaTab, setCaixaTab] = useTabParam<CaixaTab>('excecao', isCaixaTab)
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useCaixasLayout()
  const isMobile = useIsMobile()

  // Ícone por aba — o resto (ordem/visibilidade) vem do store de layout.
  const TAB_META: Record<string, { Icon: typeof LayoutDashboard }> = {
    excecao: { Icon: Sparkles },
    conferencia: { Icon: ClipboardCheck },
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

      {/* Seletor de posto — só quando o filtro tem mais de um (Todos/subconjunto). */}
      {postos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {postos.map((e) => (
            <button
              key={e.codigo}
              type="button"
              onClick={() => setActiveCodigo(e.codigo)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                e.codigo === selectedCodigo
                  ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                  : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
              )}
            >
              {e.fantasia}
            </button>
          ))}
        </div>
      )}

      {postos.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          Nenhum posto disponível.
        </p>
      )}

      {hasEmpresa && (
        showSkeleton ? (
          <TabFallback />
        ) : (
          <Suspense fallback={<TabFallback />}>
            {caixaTab === 'conferencia' ? (
              <ConferenciaPdv empresaCodigo={selectedCodigo} />
            ) : (
              <FechamentoExcecao empresaCodigo={selectedCodigo} />
            )}
          </Suspense>
        )
      )}
    </div>
  )
}

export default CaixasTurnos
