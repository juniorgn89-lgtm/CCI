import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts'
import { LayoutGrid, Fuel, Wrench, Store, DollarSign, TrendingUp, Percent, Receipt, ArrowRight, LineChart as LineChartIcon, Info } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatDate } from '@/lib/formatters'
import { smoothedProjection } from '@/lib/projection'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'

/* ─── Configuração dos segmentos ─── */

interface SegmentInfo {
  id: 'combustivel' | 'pista' | 'conveniencia'
  nome: string
  to: string
  Icon: typeof Fuel
  cor: string         // hex pra charts
  iconBg: string      // tailwind
  iconColor: string
  cardBg: string
}

const SEGMENTS: SegmentInfo[] = [
  {
    id: 'combustivel', nome: 'Combustível', to: '/comercial/vendas/combustivel', Icon: Fuel,
    cor: '#2563eb',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900',
  },
  {
    id: 'pista', nome: 'Pista', to: '/comercial/vendas/pista', Icon: Wrench,
    cor: '#f59e0b',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900',
  },
  {
    id: 'conveniencia', nome: 'Conveniência', to: '/comercial/vendas/conveniencia', Icon: Store,
    cor: '#10b981',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900',
  },
]

/* ─── KPI card top-level ─── */

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  /** Bloco rico opcional logo abaixo do hint — usado pra enriquecer os
   * cards principais (stacked bar, breakdown por segmento, etc.) e
   * equilibrar visualmente com o card de Projeção (mais denso). */
  extra?: ReactNode
  Icon: typeof Fuel
  iconBg: string
  iconColor: string
  cardBg: string
  loading: boolean
}

const KpiCard = ({ label, value, hint, extra, Icon, iconBg, iconColor, cardBg, loading }: KpiCardProps) => (
  <div className={cn('rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700', cardBg)}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
    </div>
    {loading ? (
      <Skeleton className="mt-2 h-8 w-32" />
    ) : (
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    )}
    {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
    {extra && !loading && <div className="mt-2.5 border-t border-gray-200/60 pt-2 dark:border-gray-700/60">{extra}</div>}
  </div>
)

/* ─── Página ─── */

const ComercialVendasVisaoGeral = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  // ── Fonte 1: Combustível (cache compartilhada com /operacao e /abastecimentos)
  const { kpis: opKpis, isLoading: isLoadingOp } = useOperacaoData()
  const { fuelTypeData, dailyData: combDaily, projectionMeta } = useAbastecimentosAnalytics()

  // ── Fonte 2: Conveniência (cache compartilhada com a tab Conveniência)
  const { kpis: convKpis, projecao: convProjecao, dailyData: convDaily, isLoading: isLoadingConv } = useConvenienceData()

  // ── Fonte 3: Pista — precisa de vendaItens + produtos + grupos pra
  // filtrar produtos PS-. Mesma queryKey da tela /comercial/vendas/pista
  // → uma fetch serve as duas telas.
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })
  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })
  const { data: vendaItens = [], isLoading: isLoadingVendas } = useQuery({
    queryKey: ['vendaItens-pista', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo!,
        dataInicial,
        dataFinal,
        usaProdutoLmc: false,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50,
    ),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  // ── Agrega faturamento + lucro por segmento ──
  const segmentos = useMemo(() => {
    // Combustível
    const combFat = opKpis?.faturamentoCombustivel ?? 0
    const combLucro = fuelTypeData.reduce((s, f) => s + f.lucroBruto, 0)

    // Conveniência (margem = lucro bruto absoluto no hook)
    const convFat = convKpis?.faturamento ?? 0
    const convLucro = convKpis?.margem ?? 0

    // Pista: filtra produtos PS- e soma valor/custo dos vendaItens
    let pistaFat = 0
    let pistaCusto = 0
    if (produtosData && gruposData) {
      const grupoNomes = new Map(gruposData.map((g) => [g.grupoCodigo, g.nome]))
      const psCodigos = new Set(
        produtosData
          .filter((p) => !p.combustivel && (grupoNomes.get(p.grupoCodigo) ?? '').startsWith('PS -'))
          .map((p) => p.produtoCodigo),
      )
      for (const item of vendaItens) {
        if (psCodigos.has(item.produtoCodigo)) {
          pistaFat += item.totalVenda
          pistaCusto += item.totalCusto
        }
      }
    }
    const pistaLucro = pistaFat - pistaCusto

    return {
      combustivel: {
        faturamento: combFat,
        lucro: combLucro,
        margem: combFat > 0 ? (combLucro / combFat) * 100 : 0,
      },
      pista: {
        faturamento: pistaFat,
        lucro: pistaLucro,
        margem: pistaFat > 0 ? (pistaLucro / pistaFat) * 100 : 0,
      },
      conveniencia: {
        faturamento: convFat,
        lucro: convLucro,
        margem: convFat > 0 ? (convLucro / convFat) * 100 : 0,
      },
    }
  }, [opKpis, fuelTypeData, convKpis, produtosData, gruposData, vendaItens])

  const total = useMemo(() => {
    const fat = segmentos.combustivel.faturamento + segmentos.pista.faturamento + segmentos.conveniencia.faturamento
    const lucro = segmentos.combustivel.lucro + segmentos.pista.lucro + segmentos.conveniencia.lucro
    return {
      faturamento: fat,
      lucro,
      margem: fat > 0 ? (lucro / fat) * 100 : 0,
    }
  }, [segmentos])

  /* ─── Projeções (faturamento + lucro bruto, fim do período) ───
   * Cada segmento usa sua série diária com smoothedProjection — uma chamada
   * pra faturamento e outra pra lucro bruto. Total = soma dos 3.
   * `isProjetada` = false quando o período não tem dias futuros (valor =
   * realizado, não previsão real). */
  const projecoes = useMemo(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const dias = projectionMeta?.daysRemaining ?? 0

    // Combustível — série já vem agregada do useAbastecimentosAnalytics.
    // dailyData tem faturamento E lucroBruto por dia.
    const combFat = smoothedProjection({
      realizado: segmentos.combustivel.faturamento,
      dailySeries: combDaily.map((d) => ({ data: d.data, value: d.faturamento })),
      diasRestantes: dias,
      today: todayISO,
    }).projetado
    const combLucro = smoothedProjection({
      realizado: segmentos.combustivel.lucro,
      dailySeries: combDaily.map((d) => ({ data: d.data, value: d.lucroBruto })),
      diasRestantes: dias,
      today: todayISO,
    }).projetado

    // Pista — agrega vendaItens por dia (filtrando PS-) tanto pra fat
    // quanto pra lucro bruto (= totalVenda - totalCusto).
    const pistaFatDaily = new Map<string, number>()
    const pistaLucroDaily = new Map<string, number>()
    if (produtosData && gruposData) {
      const grupoNomes = new Map(gruposData.map((g) => [g.grupoCodigo, g.nome]))
      const psCodigos = new Set(
        produtosData
          .filter((p) => !p.combustivel && (grupoNomes.get(p.grupoCodigo) ?? '').startsWith('PS -'))
          .map((p) => p.produtoCodigo),
      )
      for (const item of vendaItens) {
        if (psCodigos.has(item.produtoCodigo) && item.dataMovimento) {
          const date = item.dataMovimento.substring(0, 10)
          pistaFatDaily.set(date, (pistaFatDaily.get(date) ?? 0) + item.totalVenda)
          pistaLucroDaily.set(date, (pistaLucroDaily.get(date) ?? 0) + (item.totalVenda - item.totalCusto))
        }
      }
    }
    const pistaFat = smoothedProjection({
      realizado: segmentos.pista.faturamento,
      dailySeries: Array.from(pistaFatDaily.entries()).map(([data, value]) => ({ data, value })),
      diasRestantes: dias,
      today: todayISO,
    }).projetado
    const pistaLucro = smoothedProjection({
      realizado: segmentos.pista.lucro,
      dailySeries: Array.from(pistaLucroDaily.entries()).map(([data, value]) => ({ data, value })),
      diasRestantes: dias,
      today: todayISO,
    }).projetado

    // Conveniência — faturamento já calculado no hook; lucro projeta agora
    // a partir do dailyData (campo margemRs = lucro bruto absoluto).
    const convFat = convProjecao?.faturamento ?? 0
    const convLucro = smoothedProjection({
      realizado: segmentos.conveniencia.lucro,
      dailySeries: convDaily.map((d) => ({ data: d.data, value: d.margemRs })),
      diasRestantes: dias,
      today: todayISO,
    }).projetado

    return {
      combustivel: { faturamento: combFat, lucro: combLucro },
      pista: { faturamento: pistaFat, lucro: pistaLucro },
      conveniencia: { faturamento: convFat, lucro: convLucro },
      totalFaturamento: combFat + pistaFat + convFat,
      totalLucro: combLucro + pistaLucro + convLucro,
      isProjetada: dias > 0,
    }
  }, [segmentos, combDaily, convDaily, vendaItens, produtosData, gruposData, projectionMeta, convProjecao])

  const isLoading = isLoadingOp || isLoadingConv || isLoadingVendas

  // Melhor e pior segmento por margem — usado no card "Margem média"
  // pra dar contexto de qual segmento puxa a média pra cima/baixo.
  const margemRanking = useMemo(() => {
    const ativos = SEGMENTS.filter((s) => segmentos[s.id].faturamento > 0)
      .map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, margem: segmentos[s.id].margem }))
      .sort((a, b) => b.margem - a.margem)
    return { melhor: ativos[0] ?? null, pior: ativos[ativos.length - 1] ?? null }
  }, [segmentos])

  // Dados pros charts (donut de mix + bar de margem)
  const mixData = useMemo(
    () =>
      SEGMENTS.map((s) => ({
        nome: s.nome,
        cor: s.cor,
        faturamento: segmentos[s.id].faturamento,
        margem: segmentos[s.id].margem,
      })),
    [segmentos],
  )

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30">
            <LayoutGrid className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Vendas · Visão Geral{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Mix consolidado — combustível + pista + conveniência
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <VendasNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* KPIs principais — totais consolidados do posto + projeção */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Faturamento total"
              value={formatCurrency(total.faturamento)}
              hint="Combustível + Pista + Conveniência"
              Icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={isLoading}
              extra={
                total.faturamento > 0 ? (
                  <>
                    {/* Stacked bar com a composição do faturamento */}
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      {SEGMENTS.map((s) => {
                        const pct = (segmentos[s.id].faturamento / total.faturamento) * 100
                        return pct > 0 ? (
                          <span
                            key={s.id}
                            className="h-full"
                            style={{ width: `${pct}%`, backgroundColor: s.cor }}
                            title={`${s.nome}: ${pct.toFixed(1).replace('.', ',')}%`}
                          />
                        ) : null
                      })}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                      {SEGMENTS.map((s) => {
                        const pct = (segmentos[s.id].faturamento / total.faturamento) * 100
                        return (
                          <span key={s.id} className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.cor }} />
                            {pct.toFixed(0)}%
                          </span>
                        )
                      })}
                    </div>
                  </>
                ) : null
              }
            />
            <KpiCard
              label="Lucro bruto total"
              value={formatCurrency(total.lucro)}
              hint="Soma dos 3 segmentos"
              Icon={TrendingUp}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
              loading={isLoading}
              extra={
                total.lucro > 0 ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    {SEGMENTS.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.cor }} />
                          {s.nome}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {formatCurrencyShort(segmentos[s.id].lucro)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Margem média"
              value={`${total.margem.toFixed(1).replace('.', ',')}%`}
              hint="Lucro bruto ÷ faturamento × 100"
              Icon={Percent}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={isLoading}
              extra={
                margemRanking.melhor && margemRanking.pior && margemRanking.melhor.id !== margemRanking.pior.id ? (
                  <div className="space-y-1 text-[10px] tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: margemRanking.melhor.cor }} />
                        Maior · {margemRanking.melhor.nome}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {margemRanking.melhor.margem.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: margemRanking.pior.cor }} />
                        Menor · {margemRanking.pior.nome}
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {margemRanking.pior.margem.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Ticket médio"
              value={convKpis ? formatCurrency(convKpis.ticketMedio) : '—'}
              hint="Ticket médio da conveniência"
              Icon={Receipt}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              cardBg="bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900"
              loading={isLoading}
              extra={
                convKpis && convKpis.qtdItens > 0 ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Atendimentos</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {convKpis.qtdItens.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>vs. anterior</span>
                      <span className={cn(
                        'font-semibold',
                        convKpis.ticketMedio >= convKpis.prev.ticketMedio
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                      )}>
                        {convKpis.prev.ticketMedio > 0
                          ? `${convKpis.ticketMedio >= convKpis.prev.ticketMedio ? '+' : ''}${(((convKpis.ticketMedio - convKpis.prev.ticketMedio) / convKpis.prev.ticketMedio) * 100).toFixed(1).replace('.', ',')}%`
                          : '—'}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />

            {/* Projeção total (faturamento + lucro) — card preenchido (azul).
                Risca os valores quando não há dias futuros (= realizado). */}
            <div className="rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/90">Projeção fim do período</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                  <LineChartIcon className="h-5 w-5 text-white" />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="mt-2 h-8 w-32 bg-white/20" />
              ) : (
                <p
                  className={cn(
                    'mt-2 text-2xl font-bold tabular-nums text-white',
                    !projecoes.isProjetada && 'text-white/50 line-through decoration-white/60',
                  )}
                >
                  {formatCurrency(projecoes.totalFaturamento)}
                </p>
              )}
              <p className="mt-1 text-[11px] text-white/70">
                Faturamento estimado até {formatDate(dataFinal)}
              </p>
              {!isLoading && projecoes.isProjetada && projecoes.totalFaturamento > total.faturamento && (
                <p className="mt-1 text-[11px] tabular-nums text-emerald-300">
                  + {formatCurrency(projecoes.totalFaturamento - total.faturamento)} pra fechar
                </p>
              )}
              {/* Lucro projetado (linha separada por divisor) */}
              {!isLoading && (
                <div className="mt-3 border-t border-white/15 pt-2">
                  <p className="text-[11px] text-white/70">Lucro bruto estimado</p>
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        'text-base font-semibold tabular-nums text-white',
                        !projecoes.isProjetada && 'text-white/50 line-through decoration-white/60',
                      )}
                    >
                      {formatCurrency(projecoes.totalLucro)}
                    </p>
                    <p className="text-[11px] tabular-nums text-white/70">
                      {projecoes.totalFaturamento > 0
                        ? `${((projecoes.totalLucro / projecoes.totalFaturamento) * 100).toFixed(1).replace('.', ',')}% margem`
                        : '—'}
                    </p>
                  </div>
                </div>
              )}
              {!isLoading && !projecoes.isProjetada && (
                <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-white/70">
                  <Info className="mt-px h-3 w-3 shrink-0" />
                  Sem dias futuros — valor = realizado.
                </p>
              )}
            </div>
          </div>

          {/* Cards por segmento — cada um clicável */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {SEGMENTS.map((s) => {
              const data = segmentos[s.id]
              const Icon = s.Icon
              const pct = total.faturamento > 0 ? (data.faturamento / total.faturamento) * 100 : 0
              const proj = projecoes[s.id]
              return (
                <Link
                  key={s.id}
                  to={s.to}
                  className={cn(
                    'group rounded-xl border border-gray-200 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700',
                    s.cardBg,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.iconBg)}>
                        <Icon className={cn('h-5 w-5', s.iconColor)} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.nome}</p>
                        <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                          {pct.toFixed(1).replace('.', ',')}% do mix
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 transition-colors group-hover:text-gray-600 dark:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>
                  {isLoading ? (
                    <Skeleton className="mt-3 h-7 w-32" />
                  ) : (
                    <p className="mt-3 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(data.faturamento)}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    <span>Lucro {formatCurrency(data.lucro)}</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      margem {data.margem.toFixed(1).replace('.', ',')}%
                    </span>
                  </div>
                  {/* Projeção mini — faturamento + lucro estimados pro fim do
                      período. Riscada quando não há dias futuros (= realizado). */}
                  {!isLoading && (proj.faturamento > 0 || proj.lucro > 0) && (
                    <div className="mt-3 space-y-1 border-t border-gray-200/70 pt-2 text-[11px] dark:border-gray-700/70">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <LineChartIcon className="h-3 w-3" style={{ color: s.cor }} />
                          Projeção faturamento
                        </span>
                        <span
                          className={cn(
                            'font-semibold tabular-nums text-gray-700 dark:text-gray-300',
                            !projecoes.isProjetada && 'text-gray-400 line-through dark:text-gray-500',
                          )}
                        >
                          {formatCurrency(proj.faturamento)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 dark:text-gray-400">Projeção lucro</span>
                        <span
                          className={cn(
                            'font-semibold tabular-nums text-gray-700 dark:text-gray-300',
                            !projecoes.isProjetada && 'text-gray-400 line-through dark:text-gray-500',
                          )}
                        >
                          {formatCurrency(proj.lucro)}
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Charts: donut do mix + bar horizontal de margem */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Donut */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Participação no faturamento
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                Quanto cada segmento representa do total
              </p>
              {total.faturamento === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
                  Sem vendas no período.
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="w-[200px] shrink-0">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={mixData}
                          dataKey="faturamento"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {mixData.map((d) => (
                            <Cell key={d.nome} fill={d.cor} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {mixData.map((d) => {
                      const pct = total.faturamento > 0 ? (d.faturamento / total.faturamento) * 100 : 0
                      return (
                        <div key={d.nome} className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: d.cor }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-700 dark:text-gray-300">{d.nome}</span>
                              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                {pct.toFixed(1).replace('.', ',')}%
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                              {formatCurrency(d.faturamento)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bar chart de margem */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Margem por segmento
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                Combustível costuma ter margem menor; pista/conveniência puxam o LB
              </p>
              {total.faturamento === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
                  Sem vendas no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={mixData} layout="vertical" margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(2).replace('.', ',')}%`, 'Margem']}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
                      {mixData.map((d) => (
                        <Cell key={d.nome} fill={d.cor} />
                      ))}
                      <LabelList dataKey="margem" position="right" formatter={(v: number) => `${v.toFixed(1).replace('.', ',')}%`} style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Resumo textual abaixo dos charts (acessibilidade + leitura rápida) */}
          {total.faturamento > 0 && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Total geral: {formatCurrencyShort(total.faturamento)} · Lucro {formatCurrencyShort(total.lucro)} · Margem {total.margem.toFixed(1).replace('.', ',')}%
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default ComercialVendasVisaoGeral
