import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Users, Building2 } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { formatLitersShort } from '@/lib/formatters'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import TopBarTabs from '@/components/layout/TopBarTabs'
import { useFilterStore } from '@/store/filters'
import usePostosLitros from '@/pages/Operacao/hooks/usePostosLitros'
import useFrentistaProdutividade from '@/pages/Produtividade/hooks/useFrentistaProdutividade'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import ProdutividadeMobile from '@/pages/Produtividade/ProdutividadeMobile'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'

const ProdutividadeDash = lazy(() => import('@/pages/Produtividade/components/ProdutividadeDash'))
const ProdutividadeFuncionarios = lazy(() => import('@/pages/Produtividade/components/ProdutividadeFuncionarios'))
const ProdutividadeRede = lazy(() => import('@/pages/Produtividade/components/ProdutividadeRede'))

type ProdTab = 'dash' | 'funcionarios' | 'rede'
const TABS: { id: ProdTab; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'dash', label: 'Visão Geral', Icon: LayoutDashboard },
  { id: 'funcionarios', label: 'Funcionários', Icon: Users },
  { id: 'rede', label: 'Resumo da rede', Icon: Building2 },
]

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/**
 * Produtividade de FRENTISTA — 2 abas por posto: **Dash** (KPIs + pódios + tabela
 * por funcionário com projeção de fim de mês) e **Funcionários** (lateral com a
 * lista + detalhe: KPIs + quebra por combustível). Junta automotivos de LOJA
 * (cache) com combustível (ao vivo) por funcionário — ver useFrentistaProdutividade.
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
  const [prodTab, setProdTab] = useTabParam<ProdTab>('dash', (v): v is ProdTab => v === 'dash' || v === 'funcionarios' || v === 'rede')
  // Funcionário selecionado (compartilhado entre as abas): clicar numa linha do
  // Dash abre esse funcionário na aba Funcionários.
  const [selFunc, setSelFunc] = useState<number | null>(null)

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
  const showSkeleton = useShowSkeleton(data.isLoading, data.rows.length > 0)

  // Badge de litros por posto pras pílulas.
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

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <TopBarTabs active={prodTab} onChange={(id) => setProdTab(id as ProdTab)} tabs={TABS} />
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Seletor de posto (pílulas + litros) — a produtividade é por posto.
          No Resumo da rede é rede-wide, então o seletor fica escondido. */}
      {postos.length > 1 && prodTab !== 'rede' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            <Building2 className="h-3.5 w-3.5" /> Posto:
          </span>
          <PostoLocalSelect variant="pill" badges={badges} postos={postos} value={selectedCodigo} onChange={setDetailPosto} />
        </div>
      )}

      <Suspense fallback={<TabFallback />}>
        {prodTab === 'rede' ? (
          <ProdutividadeRede
            postos={postos}
            onOpenFuncionario={(cod, postoCod) => { setDetailPosto(postoCod); setSelFunc(cod); setProdTab('funcionarios') }}
          />
        ) : showSkeleton ? (
          <TabFallback />
        ) : prodTab === 'dash' ? (
          <ProdutividadeDash data={data} postoNome={postos.find((p) => p.codigo === selectedCodigo)?.fantasia} onOpenFuncionario={(cod) => { setSelFunc(cod); setProdTab('funcionarios') }} />
        ) : (
          <ProdutividadeFuncionarios data={data} postoCodigo={selectedCodigo} postoNome={postos.find((p) => p.codigo === selectedCodigo)?.fantasia} selId={selFunc} onSelect={setSelFunc} />
        )}
      </Suspense>
    </div>
  )
}

export default Produtividade
