import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import useTabParam from '@/hooks/useTabParam'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { useProdutividadeLayout } from '@/store/moduleLayout'
import { useFilterStore } from '@/store/filters'
import { subTabs, type SubTab } from '@/pages/Operacao/components/produtividade/subTabs'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import useIsMobile from '@/hooks/useIsMobile'
import ProdutividadeMobile from '@/pages/Produtividade/ProdutividadeMobile'
import VendedoresConveniencia from '@/pages/Produtividade/components/VendedoresConveniencia'
import ProdutividadeTodos from '@/pages/Produtividade/components/ProdutividadeTodos'

const ProdutividadeTab = lazy(() => import('@/pages/Operacao/components/ProdutividadeTab'))
const MetasFrentistas = lazy(() => import('@/pages/Produtividade/components/MetasFrentistas'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/** Abast/hora ativa — mede utilização durante o expediente real do posto. */
const ritmoPorHoraAtiva = (rows: AbastecimentoRow[]): number => {
  if (rows.length === 0) return 0
  const horasAtivas = new Set<number>()
  for (const a of rows) {
    const h = parseInt(a.dataHora?.substring(11, 13) || '', 10)
    if (!isNaN(h)) horasAtivas.add(h)
  }
  if (horasAtivas.size === 0) return 0
  return rows.length / horasAtivas.size
}

/**
 * Página Produtividade — header + DateRangeToolbar + 3 abas: Visão Geral (rede),
 * Frentistas (combustível) e Vendedores (conveniência), seguindo o padrão
 * Header → Tabs → Content.
 */
const Produtividade = () => {
  // Produtividade de frentista é por-posto (frentista trabalha numa loja). Mostra
  // UM posto por vez, com seletor quando o filtro tem mais de um (Todos/subconjunto).
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
    frentistaRows,
    abastecimentoRows,
    abastecimentoRowsPrev,
    isLoading,
    hasEmpresa,
  } = useOperacaoData(selectedCodigo)
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const isMobile = useIsMobile()
  const [prodTab, setProdTab] = useTabParam<SubTab>(
    'visao',
    (v): v is SubTab => v === 'visao' || v === 'frentistas' || v === 'vendedores' || v === 'metas',
  )
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useProdutividadeLayout()
  const subTabByKey = useMemo(() => new Map(subTabs.map((t) => [t.key, t])), [])
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Se a aba ativa foi ocultada, cai pra primeira visível.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === prodTab)) {
    setProdTab(visibleTabs[0].id as SubTab)
  }
  // Produtividade do frentista usa SEMPRE a data de abastecimento como base
  // (sem o seletor Abast./Fiscal/Movimento). Fixa o modo ao montar a tela.
  const abastDateMode = useFilterStore((s) => s.abastDateMode)
  const setAbastDateMode = useFilterStore((s) => s.setAbastDateMode)
  useEffect(() => {
    if (abastDateMode !== 'ABAST') setAbastDateMode('ABAST')
  }, [abastDateMode, setAbastDateMode])

  // Linhas com custo por abastecimento (lucro bruto), do useAbastecimentosAnalytics
  // (LMC/cache). Alimentam o Lucro bruto por dia da tabela; "—" até o custo chegar.
  const { rows: abastComCusto, descAcrByFrentista } = useAbastecimentosAnalytics(selectedCodigo)

  const ritmo = useMemo(() => ritmoPorHoraAtiva(abastecimentoRows), [abastecimentoRows])
  const ritmoPrev = useMemo(() => ritmoPorHoraAtiva(abastecimentoRowsPrev), [abastecimentoRowsPrev])

  const topFrentista = useMemo(() => {
    const ativos = frentistaRows.filter((f) => f.ativo && f.litrosVendidos > 0)
    return ativos.sort((a, b) => b.litrosVendidos - a.litrosVendidos)[0] ?? null
  }, [frentistaRows])

  const topKpis = useMemo(
    () => kpis
      ? {
          frentistasAtivos: kpis.frentistasAtivos,
          totalAbastecimentos: kpis.totalAbastecimentos,
          prevTotalAbastecimentos: kpis.prevTotalAbastecimentos,
          ritmo,
          ritmoPrev,
          topFrentistaNome: topFrentista?.nome ?? null,
          topFrentistaLitros: topFrentista?.litrosVendidos ?? 0,
        }
      : undefined,
    [kpis, ritmo, ritmoPrev, topFrentista],
  )

  // Mobile: tela própria (KPIs + ranking de frentistas).
  if (isMobile) return <ProdutividadeMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <FocusModeToggle />
        </div>
      </PageHeaderTitle>
      {hasEmpresa && visibleTabs.length > 0 && (
        <PageHeaderTitle>
          <TopBarTabs
            active={prodTab}
            onChange={(id) => setProdTab(id as SubTab)}
            tabs={visibleTabs.map((t) => ({
              id: t.id,
              label: t.label,
              Icon: subTabByKey.get(t.id as SubTab)?.icon ?? BarChart3,
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
            title="Produtividade"
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

      {hasEmpresa && prodTab === 'visao' && <ProdutividadeTodos empresaCodigo={selectedCodigo} />}

      {hasEmpresa && prodTab === 'vendedores' && <VendedoresConveniencia empresaCodigo={selectedCodigo} />}

      {hasEmpresa && prodTab === 'metas' && (
        <Suspense fallback={<TabFallback />}>
          <MetasFrentistas empresaCodigo={selectedCodigo} />
        </Suspense>
      )}

      {hasEmpresa && prodTab === 'frentistas' && (
        showSkeleton ? (
          <TabFallback />
        ) : (
          <Suspense fallback={<TabFallback />}>
            <ProdutividadeTab
              abastecimentoRows={abastecimentoRows}
              abastComCusto={abastComCusto}
              descAcrByFrentista={descAcrByFrentista}
              isLoading={isLoading}
              topKpis={topKpis}
            />
          </Suspense>
        )
      )}
    </div>
  )
}

export default Produtividade
