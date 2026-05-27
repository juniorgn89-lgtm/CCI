import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Store, CircleDollarSign, DollarSign, PieChart, Ticket, TrendingUp, TrendingDown, Package, BarChart3, ListOrdered, LayoutDashboard } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import RouteFallback from '@/components/feedback/RouteFallback'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import ProjecaoCard from '@/components/kpi/ProjecaoCard'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

// Lazy: 4 abas, cada uma é seu próprio chunk
const ConvenienciaVisaoGeral = lazy(() => import('@/pages/Comercial/Vendas/ConvenienciaVisaoGeral'))
const ParetoAnalysis = lazy(() => import('@/pages/Conveniencias/components/ParetoAnalysis'))
const CurvaABC = lazy(() => import('@/pages/Conveniencias/components/CurvaABC'))
const ProductCatalog = lazy(() => import('@/pages/Conveniencias/components/ProductCatalog'))

type TabId = 'visao' | 'pareto' | 'abc' | 'catalogo'

const TABS: { id: TabId; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'visao', label: 'Visão Geral', Icon: LayoutDashboard },
  { id: 'pareto', label: 'Análise de Pareto', Icon: BarChart3 },
  { id: 'abc', label: 'Curva ABC', Icon: ListOrdered },
  { id: 'catalogo', label: 'Catálogo', Icon: Package },
]

const pctDelta = (curr: number, prev: number): number =>
  prev > 0 ? ((curr - prev) / prev) * 100 : 0

const DeltaPill = ({ pct }: { pct: number }) => {
  if (!isFinite(pct) || pct === 0) return null
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
      up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
    )}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}{pct.toFixed(2).replace('.', ',')}%
    </span>
  )
}

interface KpiCardProps {
  label: string
  value: string
  delta?: number
  extra?: ReactNode
  Icon: typeof Store
  iconBg: string
  iconColor: string
  cardBg: string
  loading?: boolean
}

const KpiCard = ({ label, value, delta, extra, Icon, iconBg, iconColor, cardBg, loading }: KpiCardProps) => {
  if (loading) return <KpiSkeleton />
  return (
    <div className={cn('flex flex-col rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700', cardBg)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      {delta !== undefined && isFinite(delta) && delta !== 0 && (
        <div className="mt-1">
          <DeltaPill pct={delta} />
        </div>
      )}
      {extra && <div className="mt-2.5 border-t border-gray-200/60 pt-2 dark:border-gray-700/60">{extra}</div>}
    </div>
  )
}

const ContentSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <Skeleton className="mb-4 h-5 w-48" />
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  </div>
)

/**
 * Comercial · Vendas · Conveniência — cara da Pista: header + KPIs no topo +
 * switcher de 3 abas (Análise de Pareto / Curva ABC / Catálogo). Cada aba
 * reutiliza o componente standalone do módulo /conveniencias, mas a página
 * vive autônoma — não embute mais o módulo completo.
 */
interface ComercialVendasConvenienciaProps {
  /** Skip header/nav quando montada como aba do Vendas/index. */
  embedded?: boolean
}

const ComercialVendasConveniencia = ({ embedded = false }: ComercialVendasConvenienciaProps = {}) => {
  const empresaNome = useEmpresaNome()
  const { dataFinal } = useFilterStore()
  const [activeTab, setActiveTab] = useState<TabId>('visao')
  const { dataInicial } = useFilterStore()

  const {
    kpis,
    projecao,
    catalogProducts,
    gruposList,
    groupTable,
    salesByDay,
    vendaItens,
    isLoading,
    hasEmpresa,
  } = useConvenienceData()

  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  return (
    <div className="space-y-6">
      {!embedded && (
        <>
          <PageHeaderTitle>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
                <Store className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                    Vendas · Conveniência{empresaNome ? ` · ${empresaNome}` : ''}
                  </h1>
                  <FocusModeToggle />
                </div>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                  Análise de Pareto, Curva ABC e catálogo de produtos da loja
                </p>
              </div>
            </div>
          </PageHeaderTitle>
          <PageHeaderActions>
            <DateRangeToolbar />
          </PageHeaderActions>

          <VendasNav />
        </>
      )}

      {!embedded && !hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* KPIs no topo — estilo Pista (5 cards com gradiente) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Faturamento"
              value={!kpis ? '—' : formatCurrencyInt(kpis.faturamento)}
              delta={kpis ? pctDelta(kpis.faturamento, kpis.prev.faturamento) : undefined}
              Icon={CircleDollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={showSkeleton}
              extra={
                kpis ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Mês anterior</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrencyInt(kpis.prev.faturamento)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Itens vendidos</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {kpis.qtdItens.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Lucro bruto"
              value={!kpis ? '—' : formatCurrencyInt(kpis.margem)}
              delta={kpis ? pctDelta(kpis.margem, kpis.prev.margem) : undefined}
              Icon={DollarSign}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
              loading={showSkeleton}
              extra={
                kpis ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Mês anterior</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrencyInt(kpis.prev.margem)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Diferença</span>
                      <span className={cn(
                        'font-semibold',
                        kpis.margem - kpis.prev.margem >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                      )}>
                        {kpis.margem - kpis.prev.margem >= 0 ? '+' : ''}
                        {formatCurrencyInt(kpis.margem - kpis.prev.margem)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Margem"
              value={!kpis ? '—' : `${kpis.margemPct.toFixed(2).replace('.', ',')}%`}
              delta={kpis ? pctDelta(kpis.margemPct, kpis.prev.margemPct) : undefined}
              Icon={PieChart}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={showSkeleton}
              extra={
                kpis ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Mês anterior</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {kpis.prev.margemPct.toFixed(2).replace('.', ',')}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Diferença</span>
                      <span className={cn(
                        'font-semibold',
                        kpis.margemPct - kpis.prev.margemPct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                      )}>
                        {kpis.margemPct - kpis.prev.margemPct >= 0 ? '+' : ''}
                        {(kpis.margemPct - kpis.prev.margemPct).toFixed(2).replace('.', ',')}pp
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Ticket médio"
              value={!kpis ? '—' : formatCurrency(kpis.ticketMedio)}
              delta={kpis ? pctDelta(kpis.ticketMedio, kpis.prev.ticketMedio) : undefined}
              Icon={Ticket}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              cardBg="bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900"
              loading={showSkeleton}
              extra={
                kpis && kpis.qtdItens > 0 ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Mês anterior</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrency(kpis.prev.ticketMedio)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Atendimentos</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {kpis.qtdItens.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />

            <ProjecaoCard
              realizadoFaturamento={kpis?.faturamento ?? 0}
              projetadoFaturamento={projecao.faturamento}
              realizadoLucro={kpis?.margem ?? 0}
              projetadoLucro={projecao.lucroBruto}
              dataFinal={dataFinal}
              isProjetada={projecao.isProjetada}
              loading={showSkeleton}
            />
          </div>

          {/* Switcher de 3 abas */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {TABS.map((tab) => {
              const Icon = tab.Icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Conteúdo */}
          {showSkeleton ? (
            <ContentSkeleton />
          ) : (
            <Suspense fallback={<RouteFallback />}>
              {activeTab === 'visao' && (
                <ConvenienciaVisaoGeral
                  catalogProducts={catalogProducts}
                  groupTable={groupTable}
                  salesByDay={salesByDay}
                  vendaItens={vendaItens}
                  dataInicial={dataInicial}
                  dataFinal={dataFinal}
                />
              )}
              {activeTab === 'pareto' && <ParetoAnalysis products={catalogProducts} />}
              {activeTab === 'abc' && <CurvaABC products={catalogProducts} />}
              {activeTab === 'catalogo' && <ProductCatalog products={catalogProducts} gruposList={gruposList} />}
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}

export default ComercialVendasConveniencia
