import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import useTabParam from '@/hooks/useTabParam'
import { BarChart3, Building2 } from 'lucide-react'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { formatLitersShort } from '@/lib/formatters'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import TopBarTabs from '@/components/layout/TopBarTabs'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { useProdutividadeLayout } from '@/store/moduleLayout'
import { useFilterStore } from '@/store/filters'
import { subTabs, type SubTab } from '@/pages/Operacao/components/produtividade/subTabs'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import usePostosLitros from '@/pages/Operacao/hooks/usePostosLitros'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import useIsMobile from '@/hooks/useIsMobile'
import ProdutividadeMobile from '@/pages/Produtividade/ProdutividadeMobile'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import VendedoresConveniencia from '@/pages/Produtividade/components/VendedoresConveniencia'

const VisaoGeralProdutividade = lazy(() => import('@/pages/Produtividade/components/VisaoGeralProdutividade'))
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
 * Página Produtividade — Visão Geral (rede inteira) + Frentistas + Vendedores +
 * Metas. A Visão Geral resume a produtividade da pista de TODOS os postos; as
 * abas de detalhe são por-posto, com seletor em pílula (badge = litros do posto).
 * Sem gate de 1 posto: a Visão Geral abre a rede; o detalhe escolhe um posto. O
 * dado pesado single-posto (useOperacaoData) só roda nas abas de detalhe.
 */
const Produtividade = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [detailPosto, setDetailPosto] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = detailPosto != null && postoCodes.includes(detailPosto)
    ? detailPosto
    : (postos[0]?.codigo ?? null)

  const isMobile = useIsMobile()
  const [prodTab, setProdTab] = useTabParam<SubTab>(
    'visao',
    (v): v is SubTab => v === 'visao' || v === 'frentistas' || v === 'vendedores' || v === 'metas',
  )
  const { tabs: layoutTabsAll, toggleVisibility, moveUp, moveDown, reset } = useProdutividadeLayout()
  // Aba "Metas" oculta por ora (decisão de produto) — filtrada aqui, some do tab
  // bar E do menu de configuração. O store segue intacto (reativa removendo isto).
  const layoutTabs = useMemo(() => layoutTabsAll.filter((t) => t.id !== 'metas'), [layoutTabsAll])
  const subTabByKey = useMemo(() => new Map(subTabs.map((t) => [t.key, t])), [])
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Se a aba ativa foi ocultada, cai pra primeira visível.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === prodTab)) {
    setProdTab(visibleTabs[0].id as SubTab)
  }
  const isDetail = prodTab !== 'visao'

  // Produtividade do frentista usa SEMPRE a data de abastecimento como base.
  const abastDateMode = useFilterStore((s) => s.abastDateMode)
  const setAbastDateMode = useFilterStore((s) => s.setAbastDateMode)
  useEffect(() => {
    if (abastDateMode !== 'ABAST') setAbastDateMode('ABAST')
  }, [abastDateMode, setAbastDateMode])

  // Dado pesado single-posto SÓ nas abas de detalhe — a Visão Geral é rede-wide
  // (usa seu próprio hook leve). null desliga o fetch quando estamos na Visão Geral.
  const detailCodigo = isDetail ? selectedCodigo : null
  const { kpis, frentistaRows, abastecimentoRows, abastecimentoRowsPrev, isLoading } = useOperacaoData(detailCodigo)
  const { rows: abastComCusto, descAcrByFrentista } = useAbastecimentosAnalytics(detailCodigo)
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

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

  // Badge de litros por posto pras pílulas do detalhe.
  const { byPosto } = usePostosLitros()
  const badges = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of postos) {
      const l = byPosto.get(p.codigo)?.litros
      if (l != null && l > 0) m.set(p.codigo, formatLitersShort(l))
    }
    return m
  }, [postos, byPosto])

  if (isMobile) return <ProdutividadeMobile />
  if (postos.length === 0) return <SelectCompanyState />

  const abrirPosto = (codigo: number, tab: SubTab) => { setDetailPosto(codigo); setProdTab(tab) }

  return (
    <div className="space-y-6">
      {visibleTabs.length > 0 && (
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

      {/* Seletor de posto (pílulas + litros) — só nas abas de detalhe e com >1 posto. */}
      {isDetail && postos.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              <Building2 className="h-3.5 w-3.5" /> Posto:
            </span>
            <PostoLocalSelect variant="pill" badges={badges} postos={postos} value={selectedCodigo} onChange={setDetailPosto} />
          </div>
          <p className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
            Frentistas, Vendedores e Metas são <span className="font-medium text-gray-500 dark:text-gray-400">por posto</span> — escolha um aqui. O número na pílula é o volume de combustível do posto no período. A visão da rede fica na aba <span className="font-medium text-gray-500 dark:text-gray-400">Visão Geral</span>.
          </p>
        </div>
      )}

      <Suspense fallback={<TabFallback />}>
        {prodTab === 'visao' && <VisaoGeralProdutividade postos={postos} onOpenPosto={abrirPosto} />}

        {prodTab === 'vendedores' && <VendedoresConveniencia empresaCodigo={selectedCodigo} />}

        {prodTab === 'metas' && <MetasFrentistas empresaCodigo={selectedCodigo} />}

        {prodTab === 'frentistas' && (
          showSkeleton ? (
            <TabFallback />
          ) : (
            <ProdutividadeTab
              abastecimentoRows={abastecimentoRows}
              abastComCusto={abastComCusto}
              descAcrByFrentista={descAcrByFrentista}
              isLoading={isLoading}
              topKpis={topKpis}
            />
          )
        )}
      </Suspense>
    </div>
  )
}

export default Produtividade
