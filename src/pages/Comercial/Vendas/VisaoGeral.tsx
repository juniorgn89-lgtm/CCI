import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts'
import { LayoutGrid, Fuel, Wrench, Store, Globe, DollarSign, TrendingUp, Percent, Receipt, HelpCircle } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort } from '@/lib/formatters'
import { projecaoAvancada, fimDoMesIso } from '@/lib/projection'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import useFuelVendaAnalytics from '@/pages/Operacao/hooks/useFuelVendaAnalytics'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import { classifySetor } from '@/lib/setorClassification'
import useVendaCodigosAutorizados from '@/hooks/useVendaCodigosAutorizados'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import ProjecaoExecutiva from './ProjecaoExecutiva'

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
    id: 'pista', nome: 'Automotivos', to: '/comercial/vendas/pista', Icon: Wrench,
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

/* ─── Ajuda "?" (tooltip nativo) — afforda explicação sem ocupar espaço.
 * `onClick` neutraliza navegação quando usado dentro de um <Link>. ─── */
const HelpDot = ({ text }: { text: string }) => (
  <span
    title={text}
    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
    className="inline-flex cursor-help text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
  >
    <HelpCircle className="h-3 w-3" />
  </span>
)

const fmtPct2 = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

/* ─── Card de segmento (formato): Lucro bruto em destaque + 2 métricas
 * secundárias (Margem / Faturamento / L.B. por litro). Clicável quando `to`. ─── */
interface SegmentCardProps {
  label: string
  Icon: typeof Fuel
  iconBg: string
  iconColor: string
  cardBg: string
  lucroBruto: number
  primary: { label: string; value: string }
  secondary: { label: string; value: string }
  to?: string
  tooltip: string
  loading: boolean
}

const SegmentCard = ({ label, Icon, iconBg, iconColor, cardBg, lucroBruto, primary, secondary, to, tooltip, loading }: SegmentCardProps) => {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {label}
            <HelpDot text={tooltip} />
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Lucro bruto</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-28" />
      ) : (
        <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(lucroBruto)}</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div>
          <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{primary.value}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{primary.label}</p>
        </div>
        <div>
          <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{secondary.value}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{secondary.label}</p>
        </div>
      </div>
      {to && <p className="mt-2 text-right text-[10px] text-gray-400 dark:text-gray-500">Ver detalhes →</p>}
    </>
  )
  const cls = cn(
    'block rounded-xl border border-gray-200 p-5 shadow-sm transition-all dark:border-gray-700',
    to && 'hover:-translate-y-0.5 hover:shadow-md',
    cardBg,
  )
  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>
}

/* ─── KPI card top-level ─── */

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  /** Texto de ajuda no "?" ao lado do título. */
  tooltip?: string
  /** Bloco rico opcional logo abaixo do hint — usado pra enriquecer os
   * cards principais (stacked bar, breakdown por segmento, etc.) e
   * equilibrar visualmente com o card de Projeção (mais denso). */
  extra?: ReactNode
  Icon: typeof Fuel
  iconBg: string
  iconColor: string
  cardBg: string
  loading: boolean
  /** Valor projetado pra fim do mês (string já formatada). Só aparece quando o
   * período é projetável (tem dias futuros). */
  projecao?: string
}

const KpiCard = ({ label, value, hint, tooltip, extra, Icon, iconBg, iconColor, cardBg, loading, projecao }: KpiCardProps) => (
  <div className={cn('rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700', cardBg)}>
    <div className="flex items-center justify-between">
      <p className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400">
        {label}
        {tooltip && <HelpDot text={tooltip} />}
      </p>
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
    </div>
    {loading ? (
      <Skeleton className="mt-2 h-8 w-32" />
    ) : (
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    )}
    {projecao && !loading && (
      <p className="mt-1.5 flex items-center gap-1 text-[11px] tabular-nums text-indigo-600 dark:text-indigo-400" title="Projeção para o fim do mês">
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>Proj. fim do mês: <span className="font-semibold">{projecao}</span></span>
      </p>
    )}
    {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
    {extra && !loading && <div className="mt-2.5 border-t border-gray-200/60 pt-2 dark:border-gray-700/60">{extra}</div>}
  </div>
)

/* ─── Página ─── */

interface ComercialVendasVisaoGeralProps {
  /** Skip header/nav quando montada como aba do Vendas/index. */
  embedded?: boolean
}

const ComercialVendasVisaoGeral = ({ embedded = false }: ComercialVendasVisaoGeralProps = {}) => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  // ── Fonte 1: Combustível — VENDA fiscal (mesma fonte da aba
  // Combustível), não abastecimento. Garante que lucro/margem/litros batam.
  const { kpis: vendaKpis, dailyData: combDaily, isLoading: isLoadingComb } = useFuelVendaAnalytics()

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
    staleTime: 5 * 60 * 1000,
  })

  // Cruzamento /VENDA (situacao='A') — exclui cancelados da parte de pista.
  const { autorizados } = useVendaCodigosAutorizados(empresaCodigos, dataInicial, dataFinal, hasEmpresa)

  // ── Agrega faturamento + lucro por segmento ──
  const segmentos = useMemo(() => {
    // Combustível
    const combFat = vendaKpis.faturamento
    const combLucro = vendaKpis.lucroBruto

    // Conveniência (margem = lucro bruto absoluto no hook)
    const convFat = convKpis?.faturamento ?? 0
    const convLucro = convKpis?.margem ?? 0

    // Pista: filtra produtos PS- e soma valor/custo dos vendaItens
    let pistaFat = 0
    let pistaCusto = 0
    if (produtosData && gruposData) {
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      const psCodigos = new Set(
        produtosData
          .filter((p) => classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'automotivos')
          .map((p) => p.produtoCodigo),
      )
      for (const item of vendaItens) {
        if (!autorizados.has(item.vendaCodigo)) continue  // só vendas autorizadas (cruzamento /VENDA)
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
        litros: vendaKpis.litros,
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
  }, [vendaKpis, convKpis, produtosData, gruposData, vendaItens, autorizados])

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
    // Projeta SEMPRE até o fim do mês (apurados + dias faltantes, hoje incluso
    // como faltante) — independe do escopo Apurado/Em andamento/Completo.
    const monthEnd = fimDoMesIso(dataInicial || todayISO)

    // Combustível — série já vem agregada (faturamento E lucroBruto por dia).
    const comb = projecaoAvancada({ dailySeries: combDaily.map((d) => ({ data: d.data, value: d.faturamento })), today: todayISO, dataFinal: monthEnd })
    const combL = projecaoAvancada({ dailySeries: combDaily.map((d) => ({ data: d.data, value: d.lucroBruto })), today: todayISO, dataFinal: monthEnd })

    // Pista — agrega vendaItens por dia (filtrando PS-) pra fat e lucro bruto.
    const pistaFatDaily = new Map<string, number>()
    const pistaLucroDaily = new Map<string, number>()
    if (produtosData && gruposData) {
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      const psCodigos = new Set(
        produtosData
          .filter((p) => classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'automotivos')
          .map((p) => p.produtoCodigo),
      )
      for (const item of vendaItens) {
        if (!autorizados.has(item.vendaCodigo)) continue
        if (psCodigos.has(item.produtoCodigo) && item.dataMovimento) {
          const date = item.dataMovimento.substring(0, 10)
          pistaFatDaily.set(date, (pistaFatDaily.get(date) ?? 0) + item.totalVenda)
          pistaLucroDaily.set(date, (pistaLucroDaily.get(date) ?? 0) + (item.totalVenda - item.totalCusto))
        }
      }
    }
    const pista = projecaoAvancada({ dailySeries: Array.from(pistaFatDaily.entries()).map(([data, value]) => ({ data, value })), today: todayISO, dataFinal: monthEnd })
    const pistaL = projecaoAvancada({ dailySeries: Array.from(pistaLucroDaily.entries()).map(([data, value]) => ({ data, value })), today: todayISO, dataFinal: monthEnd })

    // Conveniência — fat e lucro já projetados até o fim do mês pelo useConvenienceData.
    const convFat = convProjecao?.faturamento ?? 0
    const convLucro = convProjecao?.lucroBruto ?? 0

    // Série diária COMBINADA (comb + pista + conv) → projeção total com
    // cenários/sparkline/tendência reais do conjunto (card executivo do topo).
    const fatDaily = new Map<string, number>()
    const lucroDaily = new Map<string, number>()
    const addFat = (data: string, v: number) => fatDaily.set(data, (fatDaily.get(data) ?? 0) + v)
    const addLucro = (data: string, v: number) => lucroDaily.set(data, (lucroDaily.get(data) ?? 0) + v)
    for (const d of combDaily) { addFat(d.data, d.faturamento); addLucro(d.data, d.lucroBruto) }
    for (const [data, v] of pistaFatDaily) addFat(data, v)
    for (const [data, v] of pistaLucroDaily) addLucro(data, v)
    for (const d of convDaily) { addFat(d.data, d.faturamento); addLucro(d.data, d.margemRs) }
    const fatTotal = projecaoAvancada({ dailySeries: Array.from(fatDaily.entries()).map(([data, value]) => ({ data, value })), today: todayISO, dataFinal: monthEnd })
    const lucroTotal = projecaoAvancada({ dailySeries: Array.from(lucroDaily.entries()).map(([data, value]) => ({ data, value })), today: todayISO, dataFinal: monthEnd })

    return {
      combustivel: { faturamento: comb.esperado, lucro: combL.esperado },
      pista: { faturamento: pista.esperado, lucro: pistaL.esperado },
      conveniencia: { faturamento: convFat, lucro: convLucro },
      fat: fatTotal,
      projetadoLucroTotal: lucroTotal.esperado,
      projetadoMargem: fatTotal.esperado > 0 ? (lucroTotal.esperado / fatTotal.esperado) * 100 : 0,
      // Ticket médio projetado = projeção cupons-based do próprio hook da
      // conveniência (mesma base do realizado: faturamento ÷ cupons).
      projetadoTicket: convProjecao?.ticketMedio ?? 0,
      dataFinalProjecao: monthEnd,
    }
  }, [combDaily, vendaItens, produtosData, gruposData, dataInicial, convProjecao, convDaily, autorizados])

  const isLoading = isLoadingComb || isLoadingConv || isLoadingVendas

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
      {!embedded && (
        <>
          <PageHeaderTitle>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
                <LayoutGrid className="h-4 w-4 text-white" />
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
        </>
      )}

      {!embedded && !hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* KPIs principais — totais consolidados do posto + projeção */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Faturamento total"
              value={formatCurrency(total.faturamento)}
              hint="Combustível + Pista + Conveniência"
              tooltip="Receita bruta total do posto no período = soma do faturamento de Combustível, Pista e Conveniência. 'Proj. fim do mês' estima o fechamento pelo ritmo dos últimos dias."
              Icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={isLoading}
              projecao={projecoes.fat.diasRestantes > 0 && !isLoading ? formatCurrency(projecoes.fat.esperado) : undefined}
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
              tooltip="Lucro bruto = faturamento − custo (CMV), somando os 3 segmentos. Não inclui despesas operacionais. O detalhe lista o lucro de cada segmento."
              Icon={TrendingUp}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
              loading={isLoading}
              projecao={projecoes.fat.diasRestantes > 0 && !isLoading ? formatCurrency(projecoes.projetadoLucroTotal) : undefined}
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
              tooltip="Margem bruta consolidada = (lucro bruto total ÷ faturamento total) × 100. O detalhe mostra o segmento de maior e menor margem."
              Icon={Percent}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={isLoading}
              projecao={projecoes.fat.diasRestantes > 0 && !isLoading ? `${projecoes.projetadoMargem.toFixed(1).replace('.', ',')}%` : undefined}
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
              tooltip="Ticket médio da CONVENIÊNCIA = faturamento da loja ÷ nº de cupons (atendimentos). Não inclui combustível nem pista. 'Atendimentos' é o nº de cupons no período."
              Icon={Receipt}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              cardBg="bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900"
              loading={isLoading}
              projecao={projecoes.fat.diasRestantes > 0 && !isLoading && projecoes.projetadoTicket > 0 ? formatCurrency(projecoes.projetadoTicket) : undefined}
              extra={
                convKpis && convKpis.qtdCupons > 0 ? (
                  <div className="space-y-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Atendimentos</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {convKpis.qtdCupons.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>vs. anterior</span>
                      <span className={cn(
                        'font-semibold',
                        convKpis.ticketMedio >= convKpis.cmp.ticketMedio
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400',
                      )}>
                        {convKpis.cmp.ticketMedio > 0
                          ? `${convKpis.ticketMedio >= convKpis.cmp.ticketMedio ? '+' : ''}${(((convKpis.ticketMedio - convKpis.cmp.ticketMedio) / convKpis.cmp.ticketMedio) * 100).toFixed(1).replace('.', ',')}%`
                          : '—'}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />

            <ProjecaoExecutiva
              fat={projecoes.fat}
              projetadoLucro={projecoes.projetadoLucroTotal}
              dataFinal={projecoes.dataFinalProjecao}
              loading={isLoading}
            />
          </div>

          {/* Cards por segmento — formato: Lucro bruto + 2 métricas (Combustível,
              Automotivos, Conveniência) + card Global consolidado. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SegmentCard
              label="Combustível"
              Icon={Fuel}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
              lucroBruto={segmentos.combustivel.lucro}
              primary={{ label: 'Margem', value: fmtPct2(segmentos.combustivel.margem) }}
              secondary={{ label: 'L. bruto / litro', value: formatCurrency(segmentos.combustivel.litros > 0 ? segmentos.combustivel.lucro / segmentos.combustivel.litros : 0) }}
              to="/comercial/vendas/combustivel"
              loading={isLoading}
              tooltip="Lucro bruto do combustível (faturamento − CMV) no período. Margem = lucro ÷ faturamento; L. bruto/litro = lucro ÷ litros vendidos. Clique pra abrir o detalhe."
            />
            <SegmentCard
              label="Automotivos"
              Icon={Wrench}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              lucroBruto={segmentos.pista.lucro}
              primary={{ label: 'Faturamento', value: formatCurrencyInt(segmentos.pista.faturamento) }}
              secondary={{ label: 'Margem', value: fmtPct2(segmentos.pista.margem) }}
              to="/comercial/vendas/pista"
              loading={isLoading}
              tooltip="Produtos automotivos da pista (grupos PS-): lucro bruto, faturamento e margem no período. Clique pra abrir o detalhe."
            />
            <SegmentCard
              label="Conveniência"
              Icon={Store}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              lucroBruto={segmentos.conveniencia.lucro}
              primary={{ label: 'Faturamento', value: formatCurrencyInt(segmentos.conveniencia.faturamento) }}
              secondary={{ label: 'Margem', value: fmtPct2(segmentos.conveniencia.margem) }}
              to="/comercial/vendas/conveniencia"
              loading={isLoading}
              tooltip="Loja de conveniência: lucro bruto, faturamento e margem no período. Clique pra abrir o detalhe."
            />
            <SegmentCard
              label="Global"
              Icon={Globe}
              iconBg="bg-violet-100 dark:bg-violet-900/30"
              iconColor="text-violet-600 dark:text-violet-400"
              cardBg="bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900"
              lucroBruto={total.lucro}
              primary={{ label: 'Faturamento', value: formatCurrencyInt(total.faturamento) }}
              secondary={{ label: 'Margem', value: fmtPct2(total.margem) }}
              loading={isLoading}
              tooltip="Consolidado do posto = Combustível + Automotivos + Conveniência. Lucro bruto, faturamento e margem totais do período."
            />
          </div>

          {/* Charts: donut do mix + bar horizontal de margem */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Donut */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Participação no faturamento
                <HelpDot text="Quanto cada segmento (Combustível, Pista, Conveniência) representa do faturamento total do período. Passe o mouse nas fatias pra ver o valor em R$." />
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
                          formatter={((value: number, name: string) => [formatCurrency(value), name]) as never}
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
              <h3 className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Margem por segmento
                <HelpDot text="Margem bruta (%) de cada segmento = lucro bruto ÷ faturamento do segmento. Compara a rentabilidade entre Combustível, Pista e Conveniência." />
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
                      formatter={((value: number) => [`${value.toFixed(2).replace('.', ',')}%`, 'Margem']) as never}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
                      {mixData.map((d) => (
                        <Cell key={d.nome} fill={d.cor} />
                      ))}
                      <LabelList dataKey="margem" position="right" formatter={((v: number) => `${v.toFixed(1).replace('.', ',')}%`) as never} style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} />
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
