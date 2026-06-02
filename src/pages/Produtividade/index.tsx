import { lazy, Suspense, useMemo } from 'react'
import useTabParam from '@/hooks/useTabParam'
import { BarChart3 } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { useProdutividadeLayout } from '@/store/moduleLayout'
import { subTabs, type SubTab } from '@/pages/Operacao/components/produtividade/subTabs'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import { buildScoreInputs, computeScores } from '@/lib/frentistaScore'
import useIsMobile from '@/hooks/useIsMobile'
import ProdutividadeMobile from '@/pages/Produtividade/ProdutividadeMobile'

const ProdutividadeTab = lazy(() => import('@/pages/Operacao/components/ProdutividadeTab'))

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
 * Página Produtividade — só header + DateRangeToolbar. KPIs e listas vivem
 * dentro do ProdutividadeTab, que tem suas próprias sub-tabs (Visão Geral,
 * Projeções, Metas, Destaques) seguindo o padrão Header → Tabs → Content.
 */
const Produtividade = () => {
  const {
    kpis,
    frentistaRows,
    frentistaRowsPrev,
    abastecimentoRows,
    abastecimentoRowsPrev,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const isMobile = useIsMobile()
  const [prodTab, setProdTab] = useTabParam<SubTab>(
    'visao',
    (v): v is SubTab => v === 'visao' || v === 'projecoes' || v === 'metas' || v === 'destaques',
  )
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useProdutividadeLayout()
  const subTabByKey = useMemo(() => new Map(subTabs.map((t) => [t.key, t])), [])
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Se a aba ativa foi ocultada, cai pra primeira visível.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === prodTab)) {
    setProdTab(visibleTabs[0].id as SubTab)
  }

  // Score dos frentistas — precisa do custo por abastecimento (lucro bruto),
  // que vem do useAbastecimentosAnalytics (LMC/cache). A tabela mostra "—" até
  // os custos chegarem, sem travar o resto da aba.
  const { rows: abastComCusto } = useAbastecimentosAnalytics()
  const frentistaScores = useMemo(
    () => computeScores(buildScoreInputs(abastComCusto)),
    [abastComCusto],
  )

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
      <PageHeaderTitle>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Produtividade</h1>
            <FocusModeToggle />
          </div>
          {hasEmpresa && visibleTabs.length > 0 && (
            <TopBarTabs
              active={prodTab}
              onChange={(id) => setProdTab(id as SubTab)}
              tabs={visibleTabs.map((t) => ({ id: t.id, label: t.label, Icon: subTabByKey.get(t.id as SubTab)?.icon ?? BarChart3 }))}
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
            title="Produtividade"
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
            <ProdutividadeTab
              frentistaRows={frentistaRows}
              frentistaRowsPrev={frentistaRowsPrev}
              abastecimentoRows={abastecimentoRows}
              abastecimentoRowsPrev={abastecimentoRowsPrev}
              isLoading={isLoading}
              topKpis={topKpis}
              frentistaScores={frentistaScores}
              active={prodTab}
            />
          </Suspense>
        )
      )}
    </div>
  )
}

export default Produtividade
