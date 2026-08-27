import { lazy, Suspense, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Fuel, Store, Building2, Users } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { usePersonalizedTabs } from '@/hooks/usePersonalizedTabs'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import InfoHint from '@/components/ui/InfoHint'
import { useFilterStore } from '@/store/filters'
import useFrentistaProdutividade from '@/pages/Produtividade/hooks/useFrentistaProdutividade'
import useProdutividadeRedeWide from '@/pages/Produtividade/hooks/useProdutividadeRedeWide'
import useLojaRedeWide from '@/pages/Produtividade/hooks/useLojaRedeWide'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import ProdutividadeMobile from '@/pages/Produtividade/ProdutividadeMobile'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'

const ProdutividadeDash = lazy(() => import('@/pages/Produtividade/components/ProdutividadeDash'))
const ProdutividadeLojaDash = lazy(() => import('@/pages/Produtividade/components/ProdutividadeLojaDash'))
const ProdutividadeFuncionarios = lazy(() => import('@/pages/Produtividade/components/ProdutividadeFuncionarios'))
const ProdutividadeLoja = lazy(() => import('@/pages/Produtividade/components/ProdutividadeLoja'))
const ProdutividadeRede = lazy(() => import('@/pages/Produtividade/components/ProdutividadeRede'))

type ProdTab = 'pista' | 'loja' | 'rede'
const isProdTab = (v: string | null): v is ProdTab => v === 'pista' || v === 'loja' || v === 'rede'
const TABS: { id: ProdTab; label: string; Icon: typeof Fuel }[] = [
  { id: 'pista', label: 'Pista', Icon: Fuel },
  { id: 'loja', label: 'Loja', Icon: Store },
  { id: 'rede', label: 'Resumo da rede', Icon: Building2 },
]

/** Sub-abas internas de Pista/Loja (estado local, não vão pra URL). */
type SubTab = 'resumo' | 'funcionarios'
const SUB_TABS: TopBarTab[] = [
  { id: 'resumo', label: 'Resumo', Icon: LayoutDashboard },
  { id: 'funcionarios', label: 'Funcionários', Icon: Users },
]

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/**
 * Produtividade — 3 abas top-level: **Pista** (frentistas), **Loja** (vendedores
 * de conveniência) e **Resumo da rede**. Pista e Loja têm uma sub-aba interna
 * `Resumo | Funcionários` (default Resumo): o **Resumo** é REDE-WIDE (soma o
 * filtro, pódios cross-posto) e **Funcionários** é POR POSTO (lista + detalhe).
 * Clicar num campeão/linha do Resumo cai na sub-aba Funcionários daquela aba, no
 * posto da pessoa. Junta automotivos de LOJA + combustível por funcionário do
 * cache apurado — ver useFrentistaProdutividade / useLojaRedeWide.
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
  const [prodTab, setProdTab] = useTabParam<ProdTab>('pista', isProdTab)
  // Sub-aba interna de cada aba (default Resumo). O drill de um campeão do Resumo
  // seta a sub-aba pra Funcionários DAQUELA aba (estado, não URL).
  const [pistaSub, setPistaSub] = useState<SubTab>('resumo')
  const [lojaSub, setLojaSub] = useState<SubTab>('resumo')
  // Funcionário selecionado na sub-aba Funcionários (Pista); vendedor na Loja.
  const [selFunc, setSelFunc] = useState<number | null>(null)
  const [selLoja, setSelLoja] = useState<number | null>(null)

  // Produtividade usa base FISCAL — assim os hooks de combustível leem o CACHE
  // (dias fechados do cache + só hoje ao vivo, via splitPeriodAtToday) em vez de
  // sempre bater no /ABASTECIMENTO ao vivo. Trade-off aceito pelo usuário: o
  // abastecimento de madrugada conta no dia do caixa (fiscal), não no do bico.
  const abastDateMode = useFilterStore((s) => s.abastDateMode)
  const setAbastDateMode = useFilterStore((s) => s.setAbastDateMode)
  useEffect(() => {
    if (abastDateMode !== 'FISCAL') setAbastDateMode('FISCAL')
  }, [abastDateMode, setAbastDateMode])

  const data = useFrentistaProdutividade(selectedCodigo)
  // Resumos são REDE-WIDE: agregam TODOS os postos do filtro.
  const dashData = useProdutividadeRedeWide(postos)
  const lojaDashData = useLojaRedeWide(postos)
  const showSkeletonDash = useShowSkeleton(dashData.isLoading, dashData.rows.length > 0)
  const showSkeletonLoja = useShowSkeleton(lojaDashData.isLoading, lojaDashData.rows.length > 0)
  // Rótulo de escopo dos Resumos: "Todos os postos" (sem filtro) / nome do posto
  // (só 1 no filtro) / "N postos" (vários).
  const scopeLabel = empresaCodigos.length === 0
    ? 'Todos os postos'
    : postos.length === 1
      ? (postos[0]?.fantasia ?? 'posto')
      : `${postos.length} postos`
  const postoNome = postos.find((p) => p.codigo === selectedCodigo)?.fantasia

  // Personalização (mostrar/ocultar/reordenar abas) — cai na 1ª visível se sumiu.
  const visibleTabs = usePersonalizedTabs('/produtividade', TABS)
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === prodTab)) {
      setProdTab(visibleTabs[0].id)
    }
  }, [visibleTabs, prodTab, setProdTab])

  if (isMobile) return <ProdutividadeMobile />
  if (postos.length === 0) return <SelectCompanyState />

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <TopBarTabs active={prodTab} onChange={(id) => setProdTab(id as ProdTab)} tabs={visibleTabs} />
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Sem seletor de posto próprio: a Produtividade (por posto) usa o filtro
          global de empresa. Os Resumos (Pista/Loja) e "Resumo da rede" são
          rede-wide; a sub-aba Funcionários usa o posto do filtro/drill. */}

      <Suspense fallback={<TabFallback />}>
        {prodTab === 'rede' ? (
          <ProdutividadeRede
            postos={postos}
            onOpenFuncionario={(cod, postoCod) => { setDetailPosto(postoCod); setSelFunc(cod); setPistaSub('funcionarios'); setProdTab('pista') }}
            onOpenVendedor={(cod, empresaCod) => { if (empresaCod != null) setDetailPosto(empresaCod); setSelLoja(cod); setLojaSub('funcionarios'); setProdTab('loja') }}
          />
        ) : prodTab === 'loja' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TopBarTabs active={lojaSub} onChange={(id) => setLojaSub(id as SubTab)} tabs={SUB_TABS} className="w-fit" />
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-gray-500 dark:text-gray-400">
                Conveniência
                <InfoHint text="Desempenho dos vendedores da loja: faturamento, margem, ticket médio e cupons das vendas de conveniência." />
              </span>
            </div>
            {lojaSub === 'resumo' ? (
              showSkeletonLoja ? <TabFallback /> : (
                <ProdutividadeLojaDash
                  data={lojaDashData}
                  escopo={scopeLabel}
                  onOpenVendedor={(cod, empresaCod) => { if (empresaCod != null) setDetailPosto(empresaCod); setSelLoja(cod); setLojaSub('funcionarios') }}
                />
              )
            ) : (
              <ProdutividadeLoja
                listRows={lojaDashData.rows}
                postoCodigo={selectedCodigo}
                postoNome={postoNome}
                selId={selLoja}
                onSelect={(empresaCod, cod) => { setDetailPosto(empresaCod); setSelLoja(cod) }}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TopBarTabs active={pistaSub} onChange={(id) => setPistaSub(id as SubTab)} tabs={SUB_TABS} className="w-fit" />
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-gray-500 dark:text-gray-400">
                Combustível + automotivos
                <InfoHint text="Desempenho dos frentistas: venda de combustível (litros, aditivada, mix) + produtos automotivos de loja (óleos, aditivos, filtros)." />
              </span>
            </div>
            {pistaSub === 'resumo' ? (
              showSkeletonDash ? <TabFallback /> : (
                <ProdutividadeDash
                  data={dashData}
                  postoNome={scopeLabel}
                  onOpenFuncionario={(cod, empresaCod) => { if (empresaCod != null) setDetailPosto(empresaCod); setSelFunc(cod); setPistaSub('funcionarios') }}
                />
              )
            ) : (
              showSkeletonDash ? <TabFallback /> : (
                <ProdutividadeFuncionarios
                  data={data}
                  listRows={dashData.rows}
                  postoCodigo={selectedCodigo}
                  postoNome={postoNome}
                  selId={selFunc}
                  onSelect={(empresaCod, cod) => { setDetailPosto(empresaCod); setSelFunc(cod) }}
                />
              )
            )}
          </div>
        )}
      </Suspense>
    </div>
  )
}

export default Produtividade
