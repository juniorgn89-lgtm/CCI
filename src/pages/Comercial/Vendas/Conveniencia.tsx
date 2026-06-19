import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Store, CircleDollarSign, DollarSign, PieChart, Ticket, TrendingUp, TrendingDown, Package, BarChart3, ListOrdered, LayoutDashboard, CalendarDays } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import RouteFallback from '@/components/feedback/RouteFallback'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import BarCell from '@/components/tables/BarCell'
import ProjecaoExecutiva from './ProjecaoExecutiva'
import PistaDiaModal, { type PistaDiaData } from '@/pages/Comercial/Vendas/PistaDiaModal'
import { fimDoMesIso } from '@/lib/projection'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { formatCurrency, formatCurrencyInt, formatNumber, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'

// Lazy: abas de análise, cada uma é seu próprio chunk
const ConvenienciaVisaoGeral = lazy(() => import('@/pages/Comercial/Vendas/ConvenienciaVisaoGeral'))
const ParetoAnalysis = lazy(() => import('@/pages/Conveniencias/components/ParetoAnalysis'))
const CurvaABC = lazy(() => import('@/pages/Conveniencias/components/CurvaABC'))
const ProductCatalog = lazy(() => import('@/pages/Conveniencias/components/ProductCatalog'))

type TabId = 'diadia' | 'grupo' | 'pareto' | 'abc' | 'catalogo'

const TABS: { id: TabId; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'diadia', label: 'Realizado Dia a Dia', Icon: CalendarDays },
  { id: 'grupo', label: 'Realizado por Grupo', Icon: LayoutDashboard },
  { id: 'pareto', label: 'Análise de Pareto', Icon: BarChart3 },
  { id: 'abc', label: 'Curva ABC', Icon: ListOrdered },
  { id: 'catalogo', label: 'Catálogo', Icon: Package },
]

/** Cabeçalho de GRUPO (linha superior do thead) — agrupa colunas por tema.
 * `first` omite o divisor vertical à esquerda (1º grupo). */
const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={`bg-gray-100/60 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-gray-800/60 dark:text-gray-500${first ? '' : ' border-l border-gray-200 dark:border-gray-700'}`}>
    {label}
  </th>
)

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
  /** Valor projetado pra fim do mês (string já formatada). Só aparece quando o
   * período é projetável (tem dias futuros). */
  projecao?: string
}

const KpiCard = ({ label, value, delta, extra, Icon, iconBg, iconColor, cardBg, loading, projecao }: KpiCardProps) => {
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
      {projecao && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] tabular-nums text-indigo-600 dark:text-indigo-400" title="Projeção para o fim do mês">
          <TrendingUp className="h-3 w-3 shrink-0" />
          <span>Proj. fim do mês: <span className="font-semibold">{projecao}</span></span>
        </p>
      )}
      {delta !== undefined && isFinite(delta) && delta !== 0 && (
        <div className="mt-1">
          <DeltaPill pct={delta} />
        </div>
      )}
      {extra && <div className="mt-2.5 border-t border-gray-200/60 pt-2 dark:border-gray-700/60">{extra}</div>}
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState<TabId>('diadia')
  const [selectedDia, setSelectedDia] = useState<PistaDiaData | null>(null)
  const { dataInicial } = useFilterStore()

  const {
    kpis,
    projecao,
    projecaoFat,
    catalogProducts,
    gruposList,
    groupTable,
    salesByDay,
    vendaItens,
    isLoading,
    hasEmpresa,
  } = useConvenienceData()

  const cmpLabelFull = kpis?.comparisonMode === 'prevYear' ? 'Ano anterior' : 'Mês anterior'
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)

  // Realizado dia a dia — agrega salesByDay (produtos por dia) em dia → grupos.
  // Mesma estrutura/visão da Pista; clique no dia abre o detalhe por grupo.
  const realizadoDiaADia = useMemo(() => {
    const days = Object.entries(salesByDay).map(([data, prods]) => {
      const grupoMap = new Map<string, { nome: string; qtd: number; fat: number; custo: number }>()
      let qtd = 0, fat = 0, custo = 0
      for (const p of prods) {
        qtd += p.quantidade; fat += p.faturamento; custo += p.custo
        const g = grupoMap.get(p.grupo) ?? { nome: p.grupo, qtd: 0, fat: 0, custo: 0 }
        g.qtd += p.quantidade; g.fat += p.faturamento; g.custo += p.custo
        grupoMap.set(p.grupo, g)
      }
      const grupos = Array.from(grupoMap.values())
        .map((g) => ({ ...g, lucro: g.fat - g.custo }))
        .sort((a, b) => b.fat - a.fat)
      return { data, qtd, fat, custo, lucro: fat - custo, grupos }
    }).sort((a, b) => b.data.localeCompare(a.data))
    const total = days.reduce(
      (acc, d) => ({ qtd: acc.qtd + d.qtd, fat: acc.fat + d.fat, custo: acc.custo + d.custo, lucro: acc.lucro + d.lucro }),
      { qtd: 0, fat: 0, custo: 0, lucro: 0 },
    )
    return { days, total }
  }, [salesByDay])

  // Máximos por coluna pro heatmap da tabela dia a dia (igual Pista/Combustível).
  const diaColMax = useMemo(() => {
    const days = realizadoDiaADia.days
    return {
      qtd: Math.max(...days.map((d) => d.qtd), 0),
      fat: Math.max(...days.map((d) => d.fat), 0),
      lucro: Math.max(...days.map((d) => d.lucro), 0),
      margem: Math.max(...days.map((d) => (d.fat > 0 ? (d.lucro / d.fat) * 100 : 0)), 0),
      lbMedio: Math.max(...days.map((d) => (d.qtd > 0 ? d.lucro / d.qtd : 0)), 0),
    }
  }, [realizadoDiaADia])

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
              delta={kpis ? pctDelta(kpis.faturamento, kpis.cmp.faturamento) : undefined}
              Icon={CircleDollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={showSkeleton}
              projecao={projecao.isProjetada ? formatCurrencyInt(projecao.faturamento) : undefined}
              extra={
                kpis ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabelFull}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrencyInt(kpis.cmp.faturamento)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Lucro bruto"
              value={!kpis ? '—' : formatCurrencyInt(kpis.margem)}
              delta={kpis ? pctDelta(kpis.margem, kpis.cmp.margem) : undefined}
              Icon={DollarSign}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
              loading={showSkeleton}
              projecao={projecao.isProjetada ? formatCurrencyInt(projecao.lucroBruto) : undefined}
              extra={
                kpis ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabelFull}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrencyInt(kpis.cmp.margem)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Margem"
              value={!kpis ? '—' : `${kpis.margemPct.toFixed(2).replace('.', ',')}%`}
              delta={kpis ? pctDelta(kpis.margemPct, kpis.cmp.margemPct) : undefined}
              Icon={PieChart}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={showSkeleton}
              projecao={projecao.isProjetada ? `${(projecao.faturamento > 0 ? (projecao.lucroBruto / projecao.faturamento) * 100 : 0).toFixed(2).replace('.', ',')}%` : undefined}
              extra={
                kpis ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabelFull}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {kpis.cmp.margemPct.toFixed(2).replace('.', ',')}%
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Ticket médio"
              value={!kpis ? '—' : formatCurrency(kpis.ticketMedio)}
              delta={kpis ? pctDelta(kpis.ticketMedio, kpis.cmp.ticketMedio) : undefined}
              Icon={Ticket}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              cardBg="bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900"
              loading={showSkeleton}
              projecao={projecao.isProjetada ? formatCurrency(projecao.ticketMedio) : undefined}
              extra={
                kpis && kpis.qtdItens > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabelFull}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrency(kpis.cmp.ticketMedio)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />

            <ProjecaoExecutiva
              fat={projecaoFat}
              projetadoLucro={projecao.lucroBruto}
              dataFinal={fimDoMesIso(dataInicial)}
              loading={showSkeleton}
            />
          </div>

          {/* Detalhamento de informações — UM card só (igual Pista/Combustível):
              header + sub-menu no topo, conteúdo da aba ativa no corpo. */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Detalhamento de informações
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Aqui temos todas as vendas setorizadas com maior nível de detalhes
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                        isActive
                          ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                          : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
                      )}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Conteúdo da aba ativa (flush no card) */}
            {showSkeleton ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Suspense fallback={<div className="p-4"><RouteFallback /></div>}>
                {activeTab === 'diadia' && (
                  realizadoDiaADia.days.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">Sem vendas no período.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-1.5" />
                            <GroupTh first label="Operação" colSpan={1} />
                            <GroupTh label="Financeiro" colSpan={4} />
                            <GroupTh label="Eficiência" colSpan={3} />
                          </tr>
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Data</th>
                            <th className="px-3 py-2 text-right font-medium">Qtde</th>
                            <th className="border-l border-gray-200 px-3 py-2 text-right font-medium dark:border-gray-700">Faturamento</th>
                            <th className="px-3 py-2 text-right font-medium">Custo</th>
                            <th className="px-3 py-2 text-right font-medium">Lucro Bruto</th>
                            <th className="px-3 py-2 text-right font-medium">Margem</th>
                            <th className="border-l border-gray-200 px-3 py-2 text-right font-medium dark:border-gray-700">Preço médio</th>
                            <th className="px-3 py-2 text-right font-medium">Custo médio</th>
                            <th className="px-3 py-2 text-right font-medium">L.B. Médio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {realizadoDiaADia.days.map((d) => (
                            <tr
                              key={d.data}
                              className="cursor-pointer text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/40"
                              onClick={() => setSelectedDia(d)}
                            >
                              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                                <span className="underline-offset-4 hover:underline">{formatDate(d.data)}</span>
                              </td>
                              <td className="px-2 py-1">
                                <BarCell value={d.qtd} max={diaColMax.qtd} formatted={formatNumber(Math.round(d.qtd))} color="blue" align="near" />
                              </td>
                              <td className="border-l border-gray-200 px-2 py-1 dark:border-gray-700">
                                <BarCell value={d.fat} max={diaColMax.fat} formatted={formatCurrencyInt(d.fat)} color="green" align="near" />
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(d.custo)}</td>
                              <td className="px-2 py-1">
                                <BarCell value={d.lucro} max={diaColMax.lucro} formatted={formatCurrencyInt(d.lucro)} color="green" align="near" />
                              </td>
                              <td className="px-2 py-1">
                                <BarCell value={d.fat > 0 ? (d.lucro / d.fat) * 100 : 0} max={diaColMax.margem} formatted={d.fat > 0 ? `${((d.lucro / d.fat) * 100).toFixed(2).replace('.', ',')}%` : '—'} color="amber" align="near" />
                              </td>
                              <td className="border-l border-gray-200 px-3 py-2 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">{d.qtd > 0 ? formatCurrency(d.fat / d.qtd) : '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{d.qtd > 0 ? formatCurrency(d.custo / d.qtd) : '—'}</td>
                              <td className="px-2 py-1">
                                <BarCell value={d.qtd > 0 ? d.lucro / d.qtd : 0} max={diaColMax.lbMedio} formatted={d.qtd > 0 ? formatCurrency(d.lucro / d.qtd) : '—'} color="amber" align="near" />
                              </td>
                            </tr>
                          ))}
                          {/* Total */}
                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                            <td className="px-3 py-2.5">Total</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(Math.round(realizadoDiaADia.total.qtd))}</td>
                            <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(realizadoDiaADia.total.fat)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyInt(realizadoDiaADia.total.custo)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyInt(realizadoDiaADia.total.lucro)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{realizadoDiaADia.total.fat > 0 ? `${((realizadoDiaADia.total.lucro / realizadoDiaADia.total.fat) * 100).toFixed(2).replace('.', ',')}%` : '—'}</td>
                            <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">{realizadoDiaADia.total.qtd > 0 ? formatCurrency(realizadoDiaADia.total.fat / realizadoDiaADia.total.qtd) : '—'}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{realizadoDiaADia.total.qtd > 0 ? formatCurrency(realizadoDiaADia.total.custo / realizadoDiaADia.total.qtd) : '—'}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{realizadoDiaADia.total.qtd > 0 ? formatCurrency(realizadoDiaADia.total.lucro / realizadoDiaADia.total.qtd) : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                )}
                {activeTab === 'grupo' && (
                  <ConvenienciaVisaoGeral
                    catalogProducts={catalogProducts}
                    groupTable={groupTable}
                    salesByDay={salesByDay}
                    vendaItens={vendaItens}
                    dataInicial={dataInicial}
                    dataFinal={dataFinal}
                  />
                )}
                {activeTab === 'pareto' && <div className="p-4"><ParetoAnalysis products={catalogProducts} /></div>}
                {activeTab === 'abc' && <div className="p-4"><CurvaABC products={catalogProducts} /></div>}
                {activeTab === 'catalogo' && <div className="p-4"><ProductCatalog products={catalogProducts} gruposList={gruposList} /></div>}
              </Suspense>
            )}
          </section>

          <PistaDiaModal
            open={selectedDia !== null}
            onClose={() => setSelectedDia(null)}
            detail={selectedDia}
            subtitle="Vendas da loja (conveniência)"
          />
        </>
      )}
    </div>
  )
}

export default ComercialVendasConveniencia
