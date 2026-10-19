import { lazy, Suspense, useEffect } from 'react'
import { Trophy, Building2, Radar } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import useTabParam from '@/hooks/useTabParam'
import { usePersonalizedTabs } from '@/hooks/usePersonalizedTabs'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import TopBarTabs from '@/components/layout/TopBarTabs'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'

const MargemPosto = lazy(() => import('@/pages/Comercial/components/MargemPosto'))
const Concorrencia = lazy(() => import('@/pages/Comercial/components/Concorrencia'))
const RadarPrecos = lazy(() => import('@/pages/Comercial/components/RadarPrecos'))

type TabId = 'margem' | 'concorrencia' | 'radar'

const TABS: { id: TabId; label: string; Icon: typeof Trophy; subtitle: string }[] = [
  // Radar primeiro: é a régua de preço (subir / segurar / ceder) — a antiga aba
  // "Oportunidades" foi fundida aqui, pra não haver duas leituras que discordam.
  { id: 'radar', label: 'Radar de Preços', Icon: Radar, subtitle: 'Régua de preço por posto e combustível: subir, segurar ou ceder, com o número' },
  { id: 'margem', label: 'Margem por posto', Icon: Trophy, subtitle: 'Onde a margem vaza — placar e drill por combustível' },
  { id: 'concorrencia', label: 'Concorrência', Icon: Building2, subtitle: 'Preço de praça por posto: a referência da régua' },
]

const isTabId = (v: string | null): v is TabId =>
  v === 'margem' || v === 'concorrencia' || v === 'radar'

const Comercial = () => {
  // "?tab=oportunidades" (links antigos) cai no Radar, que absorveu a aba.
  const [activeTab, setActiveTab] = useTabParam<TabId>('radar', isTabId)
  const visibleTabs = usePersonalizedTabs('/comercial', TABS)
  const [searchParams, setSearchParams] = useSearchParams()
  // Margem por posto → Radar já no posto/combustível (mesmos `?posto=&fuel=`
  // que o "Analisar" da Visão Geral do Radar usa). Radar é a aba default, então
  // o `?tab=` sai da URL e o useTabParam cai nele sozinho.
  const abrirNoRadar = (postoCodigo: number, fuel: string) => {
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    next.set('posto', String(postoCodigo))
    if (fuel) next.set('fuel', fuel); else next.delete('fuel')
    setSearchParams(next)
  }

  // Aba ativa foi ocultada na personalização → cai na 1ª visível.
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id)
    }
  }, [visibleTabs, activeTab, setActiveTab])

  return (
    <div className="space-y-4">
      <PageHeaderTitle>
        <TopBarTabs
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          tabs={visibleTabs.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon }))}
        />
      </PageHeaderTitle>

      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        {activeTab === 'margem' && <MargemPosto onGoToOportunidades={() => setActiveTab('radar')} onAnalisar={abrirNoRadar} />}
        {activeTab === 'concorrencia' && <Concorrencia />}
        {activeTab === 'radar' && <RadarPrecos />}
      </Suspense>
    </div>
  )
}

export default Comercial
