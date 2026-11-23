import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gauge, LayoutGrid, FlaskConical } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { usePersonalizedTabs } from '@/hooks/usePersonalizedTabs'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useIsMobile from '@/hooks/useIsMobile'
import InfoHint from '@/components/ui/InfoHint'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import OperacaoMobile from '@/pages/Operacao/OperacaoMobile'
import { useEscopoSegmento } from '@/hooks/useEscopoSegmento'

const VisaoGeralOperacao = lazy(() => import('@/pages/Operacao/components/VisaoGeralOperacao'))
const Bombas = lazy(() => import('@/pages/Bombas'))
const AfericoesTab = lazy(() => import('@/pages/Operacao/components/AfericoesTab'))

type OperacaoTab = 'geral' | 'bombas' | 'afericoes' | 'reabastecimento'
const isOperacaoTab = (v: string | null): v is OperacaoTab =>
  v === 'geral' || v === 'bombas' || v === 'afericoes' || v === 'reabastecimento'

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/**
 * Módulo Operação (grupo Posto) — duas abas, todos os postos do filtro do topo:
 * Visão Geral (quadro de tanques; o detalhe e o pedido
 * sugerido de cada posto abrem no modal de tanques, o pedido só para quem tem
 * `canVerReabastecimento`) e Manutenção (bombas em grupos por posto).
 */
const Operacao = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const [tab, setTab] = useTabParam<OperacaoTab>('geral', isOperacaoTab)
  const isMobile = useIsMobile()
  // Escopo só de conveniência (CNPJ da loja): não há tanque nem bomba para mostrar.
  const segmento = useEscopoSegmento()

  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  // Postos = permitidos ∩ filtro global (vazio = todos). Sem exigir 1 posto: a
  // Visão Geral abre a rede toda; as abas de detalhe escolhem um pela pílula.
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))


  // ?tab=reabastecimento sem permissão → cai em Bombas.
  // ?tab=reabastecimento (aba removida 18/10/2026: o pedido vive no modal de
  // tanques da Visão Geral) → cai na Visão Geral.
  const permTab: OperacaoTab = tab === 'reabastecimento' ? 'geral' : tab

  const tabs: TopBarTab[] = [
    { id: 'geral', label: 'Visão Geral', Icon: LayoutGrid },
    { id: 'bombas', label: 'Manutenção', Icon: Gauge },
    { id: 'afericoes', label: 'Aferições', Icon: FlaskConical },
  ]
  // Personalização (mostrar/ocultar/reordenar abas) — cai na 1ª visível se a ativa sumiu.
  const visibleTabs = usePersonalizedTabs('/operacao', tabs)
  const activeTab: OperacaoTab = visibleTabs.some((t) => t.id === permTab)
    ? permTab
    : ((visibleTabs[0]?.id as OperacaoTab) ?? permTab)

  if (segmento.soConveniencia) return <SoConvenienciaState />
  if (isMobile) return <OperacaoMobile />
  if (postos.length === 0) return <SelectCompanyState />


  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-1.5">
          <TopBarTabs active={activeTab} onChange={(id) => setTab(id as OperacaoTab)} tabs={visibleTabs} />
          <InfoHint side="bottom" text="Visão Geral: o nível dos tanques de cada posto; clique no posto para o detalhe e o pedido sugerido. Manutenção: o desgaste de cada bomba, em grupos por posto (todos os do filtro do topo). Aferições: os testes de bomba do período, por rodada (dia × posto), e os bicos sem teste." />
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <Suspense fallback={<TabFallback />}>
        {activeTab === 'geral' && <VisaoGeralOperacao />}
        {activeTab === 'bombas' && <Bombas embedded />}
        {activeTab === 'afericoes' && <AfericoesTab postos={postos} />}
      </Suspense>
    </div>
  )
}

/** Escopo só de conveniência: explica em vez de mostrar tanques zerados. */
const SoConvenienciaState = () => (
  <div className="mx-auto mt-10 max-w-md rounded-xl border border-dashed border-gray-300 px-6 py-8 text-center dark:border-gray-700">
    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Operação é dos postos de combustível</p>
    <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">O que está escolhido no filtro do topo é conveniência (CNPJ da loja): não tem tanque, bomba nem aferição. Escolha um posto de combustível para ver a operação.</p>
  </div>
)

export default Operacao
