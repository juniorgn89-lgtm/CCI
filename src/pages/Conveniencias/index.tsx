import { lazy, Suspense, useEffect, useState } from 'react'
import { Store, ShoppingCart, Package, Settings, Activity, DollarSign, TrendingUp, TrendingDown, CircleDollarSign, PieChart, Ticket, LineChart, Info } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { useConvenienciasLayout } from '@/store/moduleLayout'
// Conteúdo das abas em chunks separados (recharts/treemap só baixam quando a
// aba é aberta). Os KPIs do topo continuam instantâneos.
const ConvenienciaIndicadores = lazy(() => import('@/pages/Conveniencias/components/ConvenienciaIndicadores'))
const SalesOverview = lazy(() => import('@/pages/Conveniencias/components/SalesOverview'))
const ProductCatalog = lazy(() => import('@/pages/Conveniencias/components/ProductCatalog'))

import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

const TAB_ICONS: Record<string, typeof Store> = {
  indicadores: Activity,
  vendas: ShoppingCart,
  catalogo: Package,
}

const ContentSkeleton = () => (
  <div className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  </div>
)

const pctDelta = (curr: number, prev: number): number =>
  prev > 0 ? ((curr - prev) / prev) * 100 : 0

/** Badge de variação % (2 casas, vírgula). `light` = sobre fundo escuro. */
const DeltaPill = ({ pct, light = false }: { pct: number; light?: boolean }) => {
  if (!isFinite(pct) || pct === 0) return null
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  const color = up
    ? light ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'
    : light ? 'text-red-300' : 'text-red-600 dark:text-red-400'
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums', color)}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}{pct.toFixed(2).replace('.', ',')}%
    </span>
  )
}

interface KpiCardProps {
  label: string
  value: string
  prevValue: string
  delta: number
  Icon: typeof Store
  chipClass: string
  iconClass: string
  onClick?: () => void
}

const KpiCard = ({ label, value, prevValue, delta, Icon, chipClass, iconClass, onClick }: KpiCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', chipClass)}>
        <Icon className={cn('h-4 w-4', iconClass)} />
      </div>
    </div>
    <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">Mês anterior</p>
    <div className="flex items-center gap-1.5">
      <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{prevValue}</span>
      <DeltaPill pct={delta} />
    </div>
  </button>
)

interface ConvenienciasProps {
  /**
   * Quando true, oculta o cabeçalho (PageHeaderTitle / HeaderTray /
   * PageHeaderActions). Usado ao embutir esta tela como aba dentro de
   * Comercial · Vendas, onde o cabeçalho vem da página externa.
   */
  embedded?: boolean
}

const Conveniencias = ({ embedded = false }: ConvenienciasProps = {}) => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useConvenienciasLayout()
  // Defensivo: ignora abas legadas do layout salvo (ex.: "Mais Vendidos"
  // removida) sem depender da migração do store rodar primeiro.
  const knownTabs = layoutTabs.filter((t) => t.id in TAB_ICONS)
  const visibleTabs = knownTabs.filter((t) => t.visible)
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'indicadores')
  const {
    kpis,
    projecao,
    dailyData,
    dailyChartData,
    salesByDay,
    productsByGroup,
    groupTable,
    catalogProducts,
    topSellers,
    gruposList,
    isLoading,
    hasEmpresa,
  } = useConvenienceData()
  const empresaNome = useEmpresaNome()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0]?.id ?? 'indicadores')
  }, [visibleTabs, activeTab])

  return (
    <div className="space-y-6">
      {!embedded && (
        <>
          <PageHeaderTitle>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/30">
                <Store className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                    Conveniência{empresaNome ? ` · ${empresaNome}` : ''}
                  </h1>
                  <FocusModeToggle />
                </div>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                  Vendas, catálogo, estoque e análise de performance da loja
                </p>
              </div>
            </div>
          </PageHeaderTitle>
          <HeaderTray>
            <ModuleSettings title="Conveniência" tabs={knownTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
          </HeaderTray>
          <PageHeaderActions>
            <DateRangeToolbar />
          </PageHeaderActions>
        </>
      )}
      {embedded && (
        <HeaderTray>
          <ModuleSettings title="Conveniência" tabs={knownTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
        </HeaderTray>
      )}

      {/* Empty state */}
      {!hasEmpresa && <SelectCompanyState />}

      {/* Main content */}
      {hasEmpresa && (
        <>
          {/* KPIs principais — sempre visíveis acima das abas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Faturamento"
              value={showSkeleton || !kpis ? '—' : formatCurrencyInt(kpis.faturamento)}
              prevValue={showSkeleton || !kpis ? '—' : formatCurrencyInt(kpis.prev.faturamento)}
              delta={kpis ? pctDelta(kpis.faturamento, kpis.prev.faturamento) : 0}
              Icon={CircleDollarSign}
              chipClass="bg-blue-100 dark:bg-blue-900/30"
              iconClass="text-blue-600 dark:text-blue-400"
              onClick={() => setActiveTab('vendas')}
            />
            <KpiCard
              label="Lucro bruto"
              value={showSkeleton || !kpis ? '—' : formatCurrencyInt(kpis.margem)}
              prevValue={showSkeleton || !kpis ? '—' : formatCurrencyInt(kpis.prev.margem)}
              delta={kpis ? pctDelta(kpis.margem, kpis.prev.margem) : 0}
              Icon={DollarSign}
              chipClass="bg-emerald-100 dark:bg-emerald-900/30"
              iconClass="text-emerald-600 dark:text-emerald-400"
              onClick={() => setActiveTab('vendas')}
            />
            <KpiCard
              label="Margem"
              value={showSkeleton || !kpis ? '—' : `${kpis.margemPct.toFixed(2).replace('.', ',')}%`}
              prevValue={showSkeleton || !kpis ? '—' : `${kpis.prev.margemPct.toFixed(2).replace('.', ',')}%`}
              delta={kpis ? pctDelta(kpis.margemPct, kpis.prev.margemPct) : 0}
              Icon={PieChart}
              chipClass="bg-amber-100 dark:bg-amber-900/30"
              iconClass="text-amber-600 dark:text-amber-400"
              onClick={() => setActiveTab('vendas')}
            />
            <KpiCard
              label="Ticket médio"
              value={showSkeleton || !kpis ? '—' : formatCurrency(kpis.ticketMedio)}
              prevValue={showSkeleton || !kpis ? '—' : formatCurrency(kpis.prev.ticketMedio)}
              delta={kpis ? pctDelta(kpis.ticketMedio, kpis.prev.ticketMedio) : 0}
              Icon={Ticket}
              chipClass="bg-rose-100 dark:bg-rose-900/30"
              iconClass="text-rose-600 dark:text-rose-400"
              onClick={() => setActiveTab('vendas')}
            />

            {/* Projeção de vendas — card preenchido (azul) */}
            <button
              type="button"
              onClick={() => setActiveTab('vendas')}
              className="flex flex-col rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] p-4 text-left shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white/90">Projeção de vendas</p>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <LineChart className="h-4 w-4 text-white" />
                </div>
              </div>
              <p
                className={cn(
                  'mt-2 text-2xl font-bold tabular-nums text-white',
                  // Sem dias futuros (Apurado/Em andamento) o valor não é projeção:
                  // risca pra deixar claro que não há previsão.
                  kpis && !projecao.isProjetada && 'text-white/50 line-through decoration-white/60',
                )}
              >
                {showSkeleton || !kpis ? '—' : formatCurrencyInt(projecao.faturamento)}
              </p>
              <p className="mt-2 text-[11px] text-white/70">Previsão - Mês anterior</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs tabular-nums text-white/85">
                  {showSkeleton || !kpis ? '—' : formatCurrencyInt(projecao.comparativo)}
                </span>
                {kpis && <DeltaPill pct={projecao.variacao} light />}
              </div>
              {/* A projeção só extrapola quando há dias futuros (modo "Completo").
                  Nos modos "Apurado"/"Em andamento" o valor = realizado, então avisamos. */}
              {kpis && !projecao.isProjetada && (
                <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-white/70">
                  <Info className="mt-px h-3 w-3 shrink-0" />
                  Projeção disponível só no modo "Completo".
                </p>
              )}
            </button>
          </div>

          {visibleTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
              <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma aba visível. Use o botão ⚙️ para personalizar.</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
                {visibleTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab.id] ?? Store
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Content */}
              {showSkeleton ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
                  </div>
                  <ContentSkeleton />
                </div>
              ) : (
                <Suspense fallback={<ContentSkeleton />}>
                  {activeTab === 'indicadores' && kpis && (
                    <ConvenienciaIndicadores
                      dailyChartData={dailyChartData}
                      groupTable={groupTable}
                      topSellers={topSellers}
                      onNavigateTab={setActiveTab}
                    />
                  )}
                  {activeTab === 'vendas' && (
                    <SalesOverview
                      dailyData={dailyData}
                      groupTable={groupTable}
                      salesByDay={salesByDay}
                      productsByGroup={productsByGroup}
                      catalogProducts={catalogProducts}
                    />
                  )}
                  {activeTab === 'catalogo' && (
                    <ProductCatalog
                      products={catalogProducts}
                      gruposList={gruposList}
                    />
                  )}
                </Suspense>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Conveniencias
