import { lazy, Suspense } from 'react'
import { Flag, Sparkles, Trophy, Building2, Radar } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useComercialFlags } from '@/store/comercialFlags'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import TopBarTabs from '@/components/layout/TopBarTabs'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'

const MargemPosto = lazy(() => import('@/pages/Comercial/components/MargemPosto'))
const Oportunidades = lazy(() => import('@/pages/Comercial/components/Oportunidades'))
const Concorrencia = lazy(() => import('@/pages/Comercial/components/Concorrencia'))
const RadarPrecos = lazy(() => import('@/pages/Comercial/components/RadarPrecos'))

type TabId = 'oportunidades' | 'margem' | 'concorrencia' | 'radar'

const TABS: { id: TabId; label: string; Icon: typeof Trophy; subtitle: string }[] = [
  { id: 'oportunidades', label: 'Oportunidades', Icon: Sparkles, subtitle: 'Oportunidades de lucro priorizadas por IA' },
  { id: 'margem', label: 'Margem por posto', Icon: Trophy, subtitle: 'Onde a margem vaza — placar e drill por combustível' },
  { id: 'concorrencia', label: 'Concorrência', Icon: Building2, subtitle: 'Inteligência de preço de praça' },
  { id: 'radar', label: 'Radar de Preços', Icon: Radar, subtitle: 'Guerra de preço — margem, elasticidade e simulação até o fechamento' },
]

const isTabId = (v: string | null): v is TabId =>
  v === 'oportunidades' || v === 'margem' || v === 'concorrencia' || v === 'radar'

/** Faixa azul do flag global — estado ÚNICO (useComercialFlags), no topo de
 *  TODAS as abas. Ligado → análises usam preço de praça; desligado → média
 *  interna da rede. */
const FlagBand = () => {
  const usar = useComercialFlags((s) => s.usarPrecoPraca)
  const toggle = useComercialFlags((s) => s.toggleUsarPrecoPraca)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white">
        <Flag className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Usar preços de concorrência nas análises da rede</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {usar
            ? 'Ligado — as análises usam o preço de praça como referência (em vez da média interna).'
            : 'Desligado — as análises usam a média interna da rede como referência.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={usar}
        onClick={toggle}
        className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400', usar ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600')}
        aria-label="Usar preços de concorrência"
      >
        <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', usar ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

const Comercial = () => {
  const [activeTab, setActiveTab] = useTabParam<TabId>('oportunidades', isTabId)

  return (
    <div className="space-y-4">
      <PageHeaderTitle>
        <TopBarTabs
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          tabs={TABS.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon }))}
        />
      </PageHeaderTitle>

      <PageHeaderActions>
        {/* Radar trava no mês corrente (decisão pra frente) → sem filtro de data. */}
        {activeTab !== 'radar' && <DateRangeToolbar />}
      </PageHeaderActions>

      {/* Flag global — no topo de todas as abas, EXCETO Radar (que usa dados da
          própria rede, não preço de praça). */}
      {activeTab !== 'radar' && <FlagBand />}

      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        {activeTab === 'margem' && <MargemPosto onGoToOportunidades={() => setActiveTab('oportunidades')} />}
        {activeTab === 'oportunidades' && <Oportunidades />}
        {activeTab === 'concorrencia' && <Concorrencia />}
        {activeTab === 'radar' && <RadarPrecos />}
      </Suspense>
    </div>
  )
}

export default Comercial
