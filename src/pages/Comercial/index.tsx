import { lazy, Suspense } from 'react'
import { TrendingUp, Flag, Sparkles, BarChart3, Trophy, Building2, Hammer } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useComercialFlags } from '@/store/comercialFlags'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import TopBarTabs from '@/components/layout/TopBarTabs'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'

const MargemPosto = lazy(() => import('@/pages/Comercial/components/MargemPosto'))
const ProjecaoLB = lazy(() => import('@/pages/Comercial/components/ProjecaoLB'))

type TabId = 'oportunidades' | 'projecao' | 'margem' | 'concorrencia'

const TABS: { id: TabId; label: string; Icon: typeof Trophy; subtitle: string }[] = [
  { id: 'oportunidades', label: 'Oportunidades', Icon: Sparkles, subtitle: 'Oportunidades de lucro priorizadas por IA' },
  { id: 'projecao', label: 'Projeção de LB', Icon: BarChart3, subtitle: 'Projeção de lucro bruto e evolução semanal' },
  { id: 'margem', label: 'Margem por posto', Icon: Trophy, subtitle: 'Ranking de lucratividade por unidade' },
  { id: 'concorrencia', label: 'Concorrência', Icon: Building2, subtitle: 'Inteligência de preço de praça' },
]

const isTabId = (v: string | null): v is TabId =>
  v === 'oportunidades' || v === 'projecao' || v === 'margem' || v === 'concorrencia'

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
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', usar ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600')}
        aria-label="Usar preços de concorrência"
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', usar ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

const EmConstrucao = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
      <Hammer className="h-6 w-6 text-gray-400" />
    </span>
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
    <p className="mt-1 text-[12px] text-gray-400">Em construção — próxima aba do módulo.</p>
  </div>
)

const Comercial = () => {
  const [activeTab, setActiveTab] = useTabParam<TabId>('oportunidades', isTabId)
  const meta = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div className="space-y-4">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <TrendingUp className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">Comercial</h1>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{meta.subtitle}</p>
          </div>
        </div>
      </PageHeaderTitle>

      <PageHeaderTitle>
        <TopBarTabs
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          tabs={TABS.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon }))}
        />
      </PageHeaderTitle>

      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Flag global — no topo de todas as abas */}
      <FlagBand />

      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        {activeTab === 'margem' && <MargemPosto />}
        {activeTab === 'projecao' && <ProjecaoLB />}
        {activeTab === 'oportunidades' && <EmConstrucao label="Oportunidades" />}
        {activeTab === 'concorrencia' && <EmConstrucao label="Concorrência" />}
      </Suspense>
    </div>
  )
}

export default Comercial
