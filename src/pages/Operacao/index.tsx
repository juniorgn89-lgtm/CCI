import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gauge, Fuel, LayoutGrid, Building2 } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { useAuthStore } from '@/store/auth'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useIsMobile from '@/hooks/useIsMobile'
import { formatLitersShort } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import usePostosLitros from '@/pages/Operacao/hooks/usePostosLitros'
import OperacaoMobile from '@/pages/Operacao/OperacaoMobile'

const VisaoGeralOperacao = lazy(() => import('@/pages/Operacao/components/VisaoGeralOperacao'))
const Bombas = lazy(() => import('@/pages/Bombas'))
const Reabastecimento = lazy(() => import('@/pages/Reabastecimento'))

type OperacaoTab = 'geral' | 'bombas' | 'reabastecimento'
const isOperacaoTab = (v: string | null): v is OperacaoTab =>
  v === 'geral' || v === 'bombas' || v === 'reabastecimento'

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/**
 * Módulo Operação (grupo Posto) — Visão Geral (rede inteira) + Bombas +
 * Reabastecimento. A Visão Geral resume as duas abas de detalhe para TODOS os
 * postos; as abas de detalhe são por-posto, com o seletor em pílulas (badge =
 * litros do posto no período). O shell dona a seleção de posto (drill da Visão
 * Geral cai direto no posto certo). Reabastecimento respeita `canVerReabastecimento`.
 */
const Operacao = () => {
  const canVerReab = useAuthStore((s) => s.canVerReabastecimento)
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const [tab, setTab] = useTabParam<OperacaoTab>('geral', isOperacaoTab)
  const isMobile = useIsMobile()

  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  // Postos = permitidos ∩ filtro global (vazio = todos). Sem exigir 1 posto: a
  // Visão Geral abre a rede toda; as abas de detalhe escolhem um pela pílula.
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))

  const { byPosto } = usePostosLitros()
  const badges = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of postos) {
      const l = byPosto.get(p.codigo)?.litros
      if (l != null && l > 0) m.set(p.codigo, formatLitersShort(l))
    }
    return m
  }, [postos, byPosto])

  const [detailPosto, setDetailPosto] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = detailPosto != null && postoCodes.includes(detailPosto)
    ? detailPosto
    : (postos[0]?.codigo ?? null)

  // ?tab=reabastecimento sem permissão → cai em Bombas.
  const activeTab: OperacaoTab = tab === 'reabastecimento' && !canVerReab ? 'bombas' : tab

  if (isMobile) return <OperacaoMobile />
  if (postos.length === 0) return <SelectCompanyState />

  const tabs: TopBarTab[] = [
    { id: 'geral', label: 'Visão Geral', Icon: LayoutGrid },
    { id: 'bombas', label: 'Bombas', Icon: Gauge },
    ...(canVerReab ? [{ id: 'reabastecimento', label: 'Reabastecimento', Icon: Fuel }] : []),
  ]

  const abrirPosto = (codigo: number, destino: 'bombas' | 'reabastecimento' = 'bombas') => {
    setDetailPosto(codigo)
    setTab(destino === 'reabastecimento' && !canVerReab ? 'bombas' : destino)
  }

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-1.5">
          <TopBarTabs active={activeTab} onChange={(id) => setTab(id as OperacaoTab)} tabs={tabs} />
          <InfoHint side="bottom" text="Visão Geral: a rede inteira num quadro — litros, tanques e reposição de cada posto. Bombas: abre um posto e mostra litros por bomba, desgaste e aferições. Reabastecimento: abre um posto e mostra o nível dos tanques e quanto comprar até o fim do mês." />
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Seletor de posto (pílulas + litros) — só nas abas de detalhe e com >1 posto. */}
      {activeTab !== 'geral' && postos.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              <Building2 className="h-3.5 w-3.5" /> Posto:
            </span>
            <PostoLocalSelect variant="pill" badges={badges} postos={postos} value={selectedCodigo} onChange={setDetailPosto} />
          </div>
          <p className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
            Bombas e Reabastecimento são <span className="font-medium text-gray-500 dark:text-gray-400">por posto</span> — escolha um aqui. O número na pílula é o volume de combustível do posto no período. A visão da rede inteira fica na aba <span className="font-medium text-gray-500 dark:text-gray-400">Visão Geral</span>.
          </p>
        </div>
      )}

      <Suspense fallback={<TabFallback />}>
        {activeTab === 'geral' && <VisaoGeralOperacao postos={postos} onOpenPosto={abrirPosto} canReabastecimento={canVerReab} />}
        {activeTab === 'bombas' && <Bombas embedded empresaCodigo={selectedCodigo} />}
        {activeTab === 'reabastecimento' && <Reabastecimento embedded empresaCodigo={selectedCodigo} />}
      </Suspense>
    </div>
  )
}

export default Operacao
