import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Store, CircleDollarSign, DollarSign, PieChart, Ticket, TrendingUp, TrendingDown, Package, BarChart3, ListOrdered, LayoutDashboard, CalendarDays } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import RouteFallback from '@/components/feedback/RouteFallback'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import RealizadoChave from '@/components/kpi/RealizadoChave'
import { Skeleton } from '@/components/ui/skeleton'
import BarCell from '@/components/tables/BarCell'
import HeaderHint from '@/components/tables/HeaderHint'
import { GROUP_TINT } from '@/lib/groupTint'
import TablePager from '@/components/tables/TablePager'
import InfoHint from '@/components/ui/InfoHint'
import ProjecaoExecutiva from './ProjecaoExecutiva'
import PistaDiaModal, { type PistaDiaData } from '@/pages/Comercial/Vendas/PistaDiaModal'
import { fimDoMesIso } from '@/lib/projection'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { formatCurrency, formatCurrencyInt, formatNumber, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import AnaliseSemanalLineCard from '@/pages/Comercial/Vendas/AnaliseSemanalLineCard'
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
  /** Texto de ajuda exibido num tooltip ("?") ao lado do label. */
  help?: string
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

const KpiCard = ({ label, value, help, delta, extra, Icon, iconBg, iconColor, cardBg, loading, projecao }: KpiCardProps) => {
  if (loading) return <KpiSkeleton />
  return (
    <div className={cn('flex flex-col rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700', cardBg)}>
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
          {help && <InfoHint text={help} />}
        </p>
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
  // Página da tabela dia a dia (0-based; 0 = dias mais recentes).
  const [diaPage, setDiaPage] = useState(0)
  const { dataInicial } = useFilterStore()
  // Consolidado rede-wide: `single1Posto` libera o saldo de estoque (por-posto).
  const single1Posto = useFilterStore((s) => s.empresaCodigos.length === 1)

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

  // Tabela dia a dia paginada — 15 dias por página, mais recente primeiro.
  const DIAS_POR_PAGINA = 15
  const diasOrdenados = useMemo(
    () => [...realizadoDiaADia.days].sort((a, b) => b.data.localeCompare(a.data)),
    [realizadoDiaADia.days],
  )
  // Série ascendente (data → qtd) pro gráfico "Quantidade vendida por dia".
  const diaSerie = useMemo(
    () => [...realizadoDiaADia.days]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((d) => ({ data: d.data, litros: d.qtd, faturamento: d.fat, lbPorLitro: d.qtd > 0 ? d.lucro / d.qtd : 0 })),
    [realizadoDiaADia.days],
  )
  const diaPageCount = Math.max(1, Math.ceil(diasOrdenados.length / DIAS_POR_PAGINA))
  const diaPageSafe = Math.min(diaPage, diaPageCount - 1)
  const diasPagina = useMemo(
    () => diasOrdenados.slice(diaPageSafe * DIAS_POR_PAGINA, diaPageSafe * DIAS_POR_PAGINA + DIAS_POR_PAGINA),
    [diasOrdenados, diaPageSafe],
  )

  return (
    <div className="space-y-6">
      {!embedded && (
        <>
          <PageHeaderTitle placement="header">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
              <Store className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
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

          <PageHeaderTitle>
            <VendasNav />
          </PageHeaderTitle>
        </>
      )}

      {(
        <>
          {/* KPIs no topo — estilo Pista (5 cards com gradiente) */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-4">
          <RealizadoChave />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Faturamento"
              help="Receita das vendas de produtos de conveniência no período — base fiscal, vendas autorizadas."
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
              help="Faturamento − custo (CMV) dos produtos de conveniência no período."
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
              help="(Lucro bruto ÷ faturamento) × 100."
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
              help="Faturamento ÷ número de vendas (cupons) de conveniência no período."
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

            </div>
            </div>
            <ProjecaoExecutiva
              fat={projecaoFat}
              projetadoLucro={projecao.lucroBruto}
              dataFinal={fimDoMesIso(dataInicial)}
              comparativo={kpis && kpis.cmp.faturamento > 0 ? { anterior: kpis.cmp.faturamento, label: kpis.comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.' } : undefined}
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
                  diasOrdenados.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-400">Sem vendas no período.</div>
                  ) : (
                    <>
                    {/* Gráfico "Quantidade vendida por dia" acompanhando a tabela (≥ 2 dias). */}
                    {diaSerie.length >= 2 && (
                      <div className="px-4 pb-1 pt-4">
                        <AnaliseSemanalLineCard data={diaSerie} title="Faturamento por dia" noun="faturamento" unit="unidades" lbLabel="L.B./unidade" plotFaturamento />
                      </div>
                    )}
                    <TablePager
                      page={diaPageSafe}
                      pageCount={diaPageCount}
                      onPrev={() => setDiaPage((p) => Math.max(0, p - 1))}
                      onNext={() => setDiaPage((p) => Math.min(diaPageCount - 1, p + 1))}
                      info={`${diasOrdenados.length} dias`}
                    />
                    <div className={cn('overflow-x-auto', diaPageCount <= 1 && 'pt-3')}>
                      <table className="w-full text-sm">
                        {/* Fundo levíssimo, uma cor por grupo de coluna. */}
                        <colgroup>
                          <col />
                          <col className={GROUP_TINT.operacao} />
                          <col span={4} className={GROUP_TINT.financeiro} />
                          <col span={3} className={GROUP_TINT.eficiencia} />
                        </colgroup>
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-1.5" />
                            <GroupTh first label="Operação" colSpan={1} />
                            <GroupTh label="Financeiro" colSpan={4} />
                            <GroupTh label="Eficiência" colSpan={3} />
                          </tr>
                          <tr>
                            <HeaderHint align="left" label="Data" help="Dia do movimento (data fiscal)." />
                            <HeaderHint label="Qtde" help="Quantidade de itens de conveniência vendidos no dia." />
                            <HeaderHint groupStart label="Faturamento" help="Receita das vendas de produtos de conveniência no dia (R$)." />
                            <HeaderHint label="Custo" help="CMV (Custo da Mercadoria Vendida) = preço de custo × quantidade vendida. É o que você pagou pelos produtos vendidos — base do lucro bruto e da margem." />
                            <HeaderHint label="Lucro Bruto" help="Faturamento − Custo (CMV) do dia." />
                            <HeaderHint label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
                            <HeaderHint groupStart label="Preço médio" help="Preço de venda médio por unidade: faturamento ÷ quantidade." />
                            <HeaderHint label="Custo médio" help="Custo médio por unidade: CMV ÷ quantidade (custo unitário, não o total)." />
                            <HeaderHint label="L.B. Médio" help="Lucro bruto médio por unidade: preço médio − custo médio." />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {diasPagina.map((d) => (
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
                                <BarCell value={d.fat > 0 ? (d.lucro / d.fat) * 100 : 0} max={diaColMax.margem} formatted={d.fat > 0 ? `${((d.lucro / d.fat) * 100).toFixed(2).replace('.', ',')}%` : '—'} color="slate" align="near" />
                              </td>
                              <td className="border-l border-gray-200 px-3 py-2 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">{d.qtd > 0 ? formatCurrency(d.fat / d.qtd) : '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{d.qtd > 0 ? formatCurrency(d.custo / d.qtd) : '—'}</td>
                              <td className="px-2 py-1">
                                <BarCell value={d.qtd > 0 ? d.lucro / d.qtd : 0} max={diaColMax.lbMedio} formatted={d.qtd > 0 ? formatCurrency(d.lucro / d.qtd) : '—'} color="amber" align="near" />
                              </td>
                            </tr>
                          ))}
                          {/* Subtotal da PÁGINA visível + Total do PERÍODO (discreto) */}
                          {diasPagina.length > 0 && (() => {
                            const sub = diasPagina.reduce(
                              (a, d) => ({ qtd: a.qtd + d.qtd, fat: a.fat + d.fat, custo: a.custo + d.custo, lucro: a.lucro + d.lucro }),
                              { qtd: 0, fat: 0, custo: 0, lucro: 0 },
                            )
                            const tot = realizadoDiaADia.total
                            return (
                              <>
                                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                                  <td className="px-3 py-2.5">Nesta página <span className="ml-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{diasPagina.length} dias</span></td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(Math.round(sub.qtd))}</td>
                                  <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(sub.fat)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyInt(sub.custo)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyInt(sub.lucro)}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{sub.fat > 0 ? `${((sub.lucro / sub.fat) * 100).toFixed(2).replace('.', ',')}%` : '—'}</td>
                                  <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">{sub.qtd > 0 ? formatCurrency(sub.fat / sub.qtd) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{sub.qtd > 0 ? formatCurrency(sub.custo / sub.qtd) : '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{sub.qtd > 0 ? formatCurrency(sub.lucro / sub.qtd) : '—'}</td>
                                </tr>
                                <tr className="bg-gray-50/60 text-xs text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
                                  <td className="px-3 py-1.5 font-medium">Período <span className="ml-1 text-[11px]">{realizadoDiaADia.days.length} dias</span></td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(Math.round(tot.qtd))}</td>
                                  <td className="border-l border-gray-200 px-3 py-1.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(tot.fat)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrencyInt(tot.custo)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrencyInt(tot.lucro)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{tot.fat > 0 ? `${((tot.lucro / tot.fat) * 100).toFixed(2).replace('.', ',')}%` : '—'}</td>
                                  <td className="border-l border-gray-200 px-3 py-1.5 text-right tabular-nums dark:border-gray-700">{tot.qtd > 0 ? formatCurrency(tot.fat / tot.qtd) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{tot.qtd > 0 ? formatCurrency(tot.custo / tot.qtd) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{tot.qtd > 0 ? formatCurrency(tot.lucro / tot.qtd) : '—'}</td>
                                </tr>
                              </>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                    </>
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
                {activeTab === 'catalogo' && (
                  <div className="p-4">
                    {!single1Posto && (
                      <p className="mb-3 text-[11px] text-gray-400 dark:text-gray-500">
                        Visão consolidada da rede. O saldo de estoque (snapshot por-posto) aparece ao selecionar 1 posto.
                      </p>
                    )}
                    <ProductCatalog products={catalogProducts} gruposList={gruposList} />
                  </div>
                )}
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
