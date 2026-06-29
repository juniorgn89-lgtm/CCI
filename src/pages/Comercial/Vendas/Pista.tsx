import { lazy, Suspense, type ReactNode, useMemo, useState } from 'react'
import { Wrench, Package, TrendingUp, TrendingDown, DollarSign, Search, Trophy, LayoutDashboard, BarChart3, ListOrdered, PieChart, Receipt, CalendarDays } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoque } from '@/api/endpoints/estoques'
import { saldoAtualPorProduto } from '@/api/helpers/produtoEstoqueSaldo'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { splitPeriodAtToday, type ApuracaoVendaRow } from '@/api/supabase/apuracao'
import { useRedeVendasCache } from '@/pages/Operacao/hooks/useRedeVendasCache'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { formatCurrency, formatCurrencyInt, formatNumber, formatDate } from '@/lib/formatters'
import DeltaBadge from '@/components/kpi/DeltaBadge'
import RealizadoChave from '@/components/kpi/RealizadoChave'
import { offsetPeriod, todayLocal } from '@/lib/period'
import { classifySetor } from '@/lib/setorClassification'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import RouteFallback from '@/components/feedback/RouteFallback'
import { Skeleton } from '@/components/ui/skeleton'
import BarCell from '@/components/tables/BarCell'
import HeaderHint from '@/components/tables/HeaderHint'
import WeekNav from '@/components/tables/WeekNav'
import { groupDaysByWeek, weekChipLabel } from '@/lib/weekGroups'
import InfoHint from '@/components/ui/InfoHint'
import CoberturaBadge from '@/components/badges/CoberturaBadge'
import { diasEntreDatas } from '@/components/badges/cobertura'
import ProjecaoExecutiva from './ProjecaoExecutiva'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import { smoothedProjection, projecaoAvancada, fimDoMesIso, PROJECAO_TOOLTIP_PRODUTO } from '@/lib/projection'
import { cn } from '@/lib/utils'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import CategoriaDetalheModal, { type CategoriaData } from '@/pages/Comercial/Vendas/CategoriaDetalheModal'
import PistaDiaModal, { type PistaDiaData } from '@/pages/Comercial/Vendas/PistaDiaModal'
import useListNavigator from '@/hooks/useListNavigator'
import type { CatalogProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'

// Lazy: 3 abas extras reusam os componentes da Conveniência
const ParetoAnalysis = lazy(() => import('@/pages/Conveniencias/components/ParetoAnalysis'))
const CurvaABC = lazy(() => import('@/pages/Conveniencias/components/CurvaABC'))
const ProductCatalog = lazy(() => import('@/pages/Conveniencias/components/ProductCatalog'))

type TabId = 'diadia' | 'grupo' | 'pareto' | 'abc' | 'catalogo'

const TABS: { id: TabId; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'diadia', label: 'Realizado dia a dia', Icon: CalendarDays },
  { id: 'grupo', label: 'Realizado por grupo', Icon: LayoutDashboard },
  { id: 'pareto', label: 'Análise de Pareto', Icon: BarChart3 },
  { id: 'abc', label: 'Curva ABC', Icon: ListOrdered },
  { id: 'catalogo', label: 'Catálogo', Icon: Package },
]

/* ─── Helpers ─── */

/**
 * Categoriza um grupo PS- em uma "família" simplificada pro consultor:
 * filtros, lubrificantes, palhetas, aditivos, acessórios, baterias, serviços.
 */
const categoriaDoGrupo = (nome: string): string => {
  const u = nome.toUpperCase()
  if (u.includes('FILTRO')) return 'Filtros'
  if (u.includes('LUBRIFICANT')) return 'Lubrificantes'
  if (u.includes('PALHETA')) return 'Palhetas'
  if (u.includes('ADITIVO') || u.includes('FLUIDO')) return 'Aditivos / Fluidos'
  if (u.includes('ACESSORIO')) return 'Acessórios'
  if (u.includes('BATERIA')) return 'Baterias'
  if (u.includes('SERVICO') || u.includes('TROCA') || u.includes('CORTESIA')) return 'Serviços'
  return 'Outros'
}

const CATEGORIA_COLOR: Record<string, string> = {
  'Filtros': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
  'Lubrificantes': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
  'Palhetas': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
  'Aditivos / Fluidos': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/40',
  'Acessórios': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40',
  'Baterias': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
  'Serviços': 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-900/40',
  'Outros': 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-900/40',
}

/** Cabeçalho de GRUPO (linha superior do thead) — agrupa colunas por tema. */
const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-gray-800/60 dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
    {label}
  </th>
)

/* ─── KPI card (mesmo padrão da tela Combustível) ─── */

interface KpiCardProps {
  label: string
  value: string
  /** Texto de ajuda exibido num tooltip ("?") ao lado do label. */
  help?: string
  hint?: string
  /** Bloco rico opcional após hint (divisor + linha de contexto adicional). */
  extra?: ReactNode
  Icon: typeof Package
  iconBg: string
  iconColor: string
  cardBg: string
  loading: boolean
  /** Valor projetado pra fim do mês (string já formatada). Só aparece quando o
   * período é projetável (tem dias futuros). */
  projecao?: string
  /** Comparação com o período anterior (DeltaBadge). */
  current?: number
  previous?: number
  comparisonLabel?: string
}

const KpiCard = ({ label, value, help, hint, extra, Icon, iconBg, iconColor, cardBg, loading, projecao, current, previous, comparisonLabel }: KpiCardProps) => (
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
    {loading ? (
      <Skeleton className="mt-2 h-8 w-32" />
    ) : (
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    )}
    {!loading && (
      <div className="min-h-[1.25rem]">
        {current !== undefined && previous !== undefined && (
          <DeltaBadge current={current} previous={previous} label={comparisonLabel} />
        )}
      </div>
    )}
    {projecao && !loading && (
      <p className="mt-1.5 flex items-center gap-1 text-[11px] tabular-nums text-indigo-600 dark:text-indigo-400" title="Projeção para o fim do mês">
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>Proj. fim do mês: <span className="font-semibold">{projecao}</span></span>
      </p>
    )}
    {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
    {extra && !loading && <div className="mt-auto border-t border-gray-200/60 pt-2.5 dark:border-gray-700/60">{extra}</div>}
  </div>
)

/* ─── Página ─── */

interface ComercialVendasPistaProps {
  /** Skip header/nav quando montada como aba do Vendas/index. */
  embedded?: boolean
}

/** "Item" agregado (por empresa·dia·produto) derivado do cache apuracao_vendas —
 * shape mínimo que os memos da Pista consomem (sem item de venda cru). */
interface AggItem {
  produtoCodigo: number
  quantidade: number
  totalVenda: number
  totalCusto: number
  dataMovimento: string
  empresaCodigo: number
}

const ComercialVendasPista = ({ embedded = false }: ComercialVendasPistaProps = {}) => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  // Consolidado rede-wide (cache apuracao_vendas, setor=automotivos). `single1Posto`
  // libera o único bloco por-posto que não consolida: saldo de estoque.
  const single1Posto = empresaCodigos.length === 1
  const empresaEstoque = single1Posto ? empresaCodigos[0] : null
  // "Todos" ([]) = postos PERMITIDOS (não a rede RLS inteira) — senão a aba
  // somaria postos fora da permissão e divergiria da Visão Geral.
  const { data: empresasDataPerm } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasDataPerm?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(empresasPermitidas.map((e) => e.codigo)), [empresasPermitidas])
  const empresaNome = useEmpresaNome()
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  // Comparativo "mesmos dias decorridos": corta o fim em hoje.
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const prevInicial = offsetPeriod(dataInicial, cmpOffset)
  const prevFinal = offsetPeriod(fimEfetivo, cmpOffset)
  // Cache compartilhada — só pra ler `projectionMeta.daysRemaining`.
  const { projectionMeta } = useAbastecimentosAnalytics()

  // Aba ativa (Visão Geral por padrão — mostra "Por categoria" + "Top 20 produtos")
  const [activeTab, setActiveTab] = useState<TabId>('diadia')
  // Modal de detalhe do dia — navegável ‹ › pela lista de dias da semana ativa.
  const diaNav = useListNavigator<PistaDiaData>()
  // Semana ativa da tabela dia a dia (chave = 2ª-feira; null = mais recente).
  const [activeMonday, setActiveMonday] = useState<string | null>(null)

  // Filtros da tabela de produtos
  const [searchProduto, setSearchProduto] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [estoqueFiltro, setEstoqueFiltro] = useState<'todos' | 'sem-estoque' | 'critico' | 'atencao' | 'ok' | 'sem-dados'>('todos')
  // Modal de drill-down ao clicar numa categoria — navegável ‹ › entre categorias.
  const catNav = useListNavigator<CategoriaData>()
  // Linha destacada na tabela "Top 20 produtos" — útil pra comparar valores visualmente
  const [selectedProduto, setSelectedProduto] = useState<number | null>(null)
  const toggleProdutoSelected = (codigo: number) => {
    setSelectedProduto((curr) => (curr === codigo ? null : codigo))
  }

  // Carrega produtos + grupos pra montar o mapa de produtos PS-.
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

  // Saldo de estoque por produto — snapshot POR-POSTO (não consolida na rede),
  // então só com 1 posto. Mesma queryKey de Conveniências (cache compartilhada).
  const { data: estoqueRaw } = useQuery({
    queryKey: ['produtoEstoque', empresaEstoque],
    queryFn: () => fetchProdutoEstoque({
      empresaCodigo: empresaEstoque!,
      limite: 1000,
    }),
    enabled: empresaEstoque !== null,
    staleTime: 5 * 60 * 1000,
  })

  // Vendas CONSOLIDADAS via cache (apuracao_vendas, setor=automotivos). Fetch
  // rede-wide (RLS) keyed só pelo range → trocar de posto re-agrega no cliente,
  // sem refetch (instantâneo). Só dias FECHADOS (decisão alinhada); prev é
  // histórico (range inteiro). vendaCodigo não existe no cache → ticket médio
  // vem do `cupons` (distinto por empresa+dia+setor), somado à parte.
  const splitCur = splitPeriodAtToday(dataInicial, dataFinal)
  const curIni = splitCur.closedDays?.dataInicial ?? ''
  const curEnd = splitCur.closedDays?.dataFinal ?? ''
  // Fetch rede-wide COMPARTILHADO (chave canônica) — mesma leitura que Combustível
  // e Conveniência reaproveitam via React Query (ver useRedeVendasCache).
  const { data: cacheCur = [], isLoading: isLoadingVendas } = useRedeVendasCache(curIni, curEnd)
  const { data: cachePrev = [] } = useRedeVendasCache(prevInicial, prevFinal)

  // Rows do cache (automotivos, posto selecionado) → "itens" agregados que os
  // memos já consomem (vendaCodigo dispensado). `[]` = rede; subconjunto = recorte.
  const toAggItens = (rows: ApuracaoVendaRow[]): AggItem[] => {
    const match = (code: number) => empresaCodigos.length === 0 ? permittedCodes.has(code) : empresaCodigos.includes(code)
    return rows
      .filter((r) => r.setor === 'automotivos' && match(r.empresa_codigo) && r.quantidade !== 0)
      .map((r) => ({
        produtoCodigo: r.produto_codigo,
        quantidade: r.quantidade,
        totalVenda: r.total_venda,
        totalCusto: r.total_custo,
        dataMovimento: r.data,
        empresaCodigo: r.empresa_codigo,
      }))
  }
  // Cupons distintos com produto de pista (dedup por empresa+dia — o valor é
  // desnormalizado por linha). Denominador do ticket médio.
  const sumCupons = (rows: ApuracaoVendaRow[]): number => {
    const match = (code: number) => empresaCodigos.length === 0 ? permittedCodes.has(code) : empresaCodigos.includes(code)
    const byDay = new Map<string, number>()
    for (const r of rows) {
      if (r.setor !== 'automotivos' || !match(r.empresa_codigo) || r.cupons <= 0) continue
      byDay.set(`${r.empresa_codigo}|${r.data}`, r.cupons)
    }
    let t = 0
    for (const v of byDay.values()) t += v
    return t
  }
  const vendaItens = useMemo(() => toAggItens(cacheCur), [cacheCur, empresaCodigos, permittedCodes]) // eslint-disable-line react-hooks/exhaustive-deps
  const vendaItensPrev = useMemo(() => toAggItens(cachePrev), [cachePrev, empresaCodigos, permittedCodes]) // eslint-disable-line react-hooks/exhaustive-deps
  const cuponsAtual = useMemo(() => sumCupons(cacheCur), [cacheCur, empresaCodigos, permittedCodes]) // eslint-disable-line react-hooks/exhaustive-deps
  const cuponsPrev = useMemo(() => sumCupons(cachePrev), [cachePrev, empresaCodigos, permittedCodes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cruza tudo: pista produtos + vendas, agrupado por categoria
  const computed = useMemo(() => {
    if (!produtosData || !gruposData) return null

    // Mapa grupoCodigo → nome / tipoGrupo
    const grupoMap = new Map<number, string>()
    const grupoTipo = new Map<number, string>()
    for (const g of gruposData) { grupoMap.set(g.grupoCodigo, g.nome); grupoTipo.set(g.grupoCodigo, g.tipoGrupo) }

    // Produtos de automotivos — régua: tipoGrupo "Pista" e tipoProduto ≠ "C".
    const pistaProdutos = new Map<number, { nome: string; grupoNome: string; categoria: string; referencia: string }>()
    for (const p of produtosData) {
      if (classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) !== 'automotivos') continue
      const grupoNome = grupoMap.get(p.grupoCodigo) ?? ''
      pistaProdutos.set(p.produtoCodigo, {
        nome: p.nome,
        grupoNome,
        categoria: categoriaDoGrupo(grupoNome),
        referencia: p.referenciaCodigo || p.produtoCodigoExterno || '',
      })
    }

    // Agrega vendas por produto pista
    interface ProdutoAgg {
      produtoCodigo: number
      nome: string
      grupoNome: string
      categoria: string
      referencia: string
      quantidade: number
      faturamento: number
      custo: number
    }
    const porProduto = new Map<number, ProdutoAgg>()
    for (const item of vendaItens) {
      const pista = pistaProdutos.get(item.produtoCodigo)
      if (!pista) continue
      const prev = porProduto.get(item.produtoCodigo) ?? {
        produtoCodigo: item.produtoCodigo,
        nome: pista.nome,
        grupoNome: pista.grupoNome,
        categoria: pista.categoria,
        referencia: pista.referencia,
        quantidade: 0,
        faturamento: 0,
        custo: 0,
      }
      prev.quantidade += item.quantidade
      prev.faturamento += item.totalVenda
      prev.custo += item.totalCusto
      porProduto.set(item.produtoCodigo, prev)
    }

    // Lista plana de produtos com venda > 0
    const produtosVendidos = Array.from(porProduto.values())
      .filter((p) => p.faturamento > 0)
      .sort((a, b) => b.faturamento - a.faturamento)

    // Agrega por categoria
    interface CategoriaAgg {
      nome: string
      qtdProdutos: number
      qtdVendida: number
      faturamento: number
      custo: number
    }
    const porCategoria = new Map<string, CategoriaAgg>()
    for (const p of produtosVendidos) {
      const prev = porCategoria.get(p.categoria) ?? {
        nome: p.categoria,
        qtdProdutos: 0,
        qtdVendida: 0,
        faturamento: 0,
        custo: 0,
      }
      prev.qtdProdutos++
      prev.qtdVendida += p.quantidade
      prev.faturamento += p.faturamento
      prev.custo += p.custo
      porCategoria.set(p.categoria, prev)
    }
    const categorias = Array.from(porCategoria.values()).sort((a, b) => b.faturamento - a.faturamento)

    // Totais
    const totalQtd = produtosVendidos.reduce((s, p) => s + p.quantidade, 0)
    const totalFat = produtosVendidos.reduce((s, p) => s + p.faturamento, 0)
    const totalCusto = produtosVendidos.reduce((s, p) => s + p.custo, 0)
    const margemPct = totalFat > 0 ? ((totalFat - totalCusto) / totalFat) * 100 : 0

    return {
      produtosVendidos,
      categorias,
      kpis: {
        produtosDistintos: produtosVendidos.length,
        unidadesVendidas: totalQtd,
        faturamento: totalFat,
        margem: totalFat - totalCusto,
        margemPct,
      },
    }
  }, [produtosData, gruposData, vendaItens])

  /* KPIs de VALOR (cards no padrão) — atual + período anterior, sobre os
   * mesmos produtos PS- (pista/automotivo). Ticket = faturamento ÷ nº de vendas. */
  const cmpKpis = useMemo(() => {
    // `vendaItens`/`vendaItensPrev` já vêm filtrados pra automotivos do cache.
    // Ticket médio = faturamento ÷ CUPONS (cupons distintos com produto de pista).
    const tot = (itens: AggItem[], cupons: number) => {
      let fat = 0, custo = 0
      for (const it of itens) { fat += it.totalVenda; custo += it.totalCusto }
      const lucro = fat - custo
      return {
        faturamento: fat,
        lucroBruto: lucro,
        margemPct: fat > 0 ? (lucro / fat) * 100 : 0,
        ticketMedio: cupons > 0 ? fat / cupons : 0,
        qtdVendas: cupons,
      }
    }
    return { atual: tot(vendaItens, cuponsAtual), prev: tot(vendaItensPrev, cuponsPrev) }
  }, [vendaItens, vendaItensPrev, cuponsAtual, cuponsPrev])

  /* Tabela "Realizado dia a dia" — hierárquica: dia → grupo (PS-) → produto.
   * Colunas: Qtde, Faturamento, Custo, Lucro bruto, Margem, Preço/Custo/L.B. médio
   * (médios = total ÷ Qtde). Igual ao relatório. */
  const realizadoDiaADia = useMemo(() => {
    const info = new Map<number, { nome: string; grupoNome: string }>()
    if (produtosData && gruposData) {
      const grupoMap = new Map(gruposData.map((g) => [g.grupoCodigo, g.nome]))
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      for (const p of produtosData) {
        if (classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) !== 'automotivos') continue
        info.set(p.produtoCodigo, { nome: p.nome, grupoNome: grupoMap.get(p.grupoCodigo) ?? '' })
      }
    }
    interface Prod { produtoCodigo: number; nome: string; qtd: number; fat: number; custo: number }
    interface Grupo { nome: string; qtd: number; fat: number; custo: number; produtos: Map<number, Prod> }
    interface Dia { data: string; qtd: number; fat: number; custo: number; grupos: Map<string, Grupo> }
    const byDay = new Map<string, Dia>()
    for (const it of vendaItens) {
      const inf = info.get(it.produtoCodigo)
      if (!inf || it.quantidade <= 0) continue
      const day = it.dataMovimento?.slice(0, 10)
      if (!day) continue
      const d = byDay.get(day) ?? { data: day, qtd: 0, fat: 0, custo: 0, grupos: new Map() }
      d.qtd += it.quantidade; d.fat += it.totalVenda; d.custo += it.totalCusto
      const g = d.grupos.get(inf.grupoNome) ?? { nome: inf.grupoNome, qtd: 0, fat: 0, custo: 0, produtos: new Map() }
      g.qtd += it.quantidade; g.fat += it.totalVenda; g.custo += it.totalCusto
      const pr = g.produtos.get(it.produtoCodigo) ?? { produtoCodigo: it.produtoCodigo, nome: inf.nome, qtd: 0, fat: 0, custo: 0 }
      pr.qtd += it.quantidade; pr.fat += it.totalVenda; pr.custo += it.totalCusto
      g.produtos.set(it.produtoCodigo, pr)
      d.grupos.set(inf.grupoNome, g)
      byDay.set(day, d)
    }
    const days = Array.from(byDay.values())
      .map((d) => ({
        data: d.data,
        qtd: d.qtd, fat: d.fat, custo: d.custo, lucro: d.fat - d.custo,
        grupos: Array.from(d.grupos.values())
          .map((g) => ({
            nome: g.nome,
            qtd: g.qtd, fat: g.fat, custo: g.custo, lucro: g.fat - g.custo,
            produtos: Array.from(g.produtos.values())
              .map((p) => ({ ...p, lucro: p.fat - p.custo }))
              .sort((a, b) => b.fat - a.fat),
          }))
          .sort((a, b) => b.fat - a.fat),
      }))
      .sort((a, b) => b.data.localeCompare(a.data))
    const total = days.reduce(
      (acc, d) => ({ qtd: acc.qtd + d.qtd, fat: acc.fat + d.fat, custo: acc.custo + d.custo, lucro: acc.lucro + d.lucro }),
      { qtd: 0, fat: 0, custo: 0, lucro: 0 },
    )
    return { days, total }
  }, [vendaItens, produtosData, gruposData])

  // Máximos por coluna pro heatmap (Data Bars) da tabela dia a dia — mesmo
  // padrão da aba Combustível (maior valor da coluna = barra mais longa).
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

  // Semanas (seg–dom) da tabela dia a dia + semana ativa (default = mais recente).
  const semanas = useMemo(() => groupDaysByWeek(realizadoDiaADia.days, (d) => d.data), [realizadoDiaADia.days])
  const activeWeekIdx = useMemo(() => {
    if (activeMonday) {
      const i = semanas.findIndex((s) => s.monday === activeMonday)
      if (i >= 0) return i
    }
    return semanas.length - 1
  }, [semanas, activeMonday])
  const semanaAtiva = semanas[activeWeekIdx]

  // Mapa produtoCodigo → saldo de estoque. Dedup das duplicatas do
  // /PRODUTO_ESTOQUE (somar registros inflava o saldo). Usado pelo filtro de
  // estoque, pelo modal e pela tabela.
  const estoquePorProduto = useMemo(
    () => saldoAtualPorProduto(estoqueRaw?.resultados ?? []),
    [estoqueRaw],
  )

  const diasPeriodo = useMemo(() => diasEntreDatas(dataInicial, dataFinal), [dataInicial, dataFinal])

  // Mapeia produtosVendidos pro formato CatalogProduct das abas Pareto/ABC/Catálogo
  // (reaproveita componentes da Conveniência sem precisar duplicar). Aqui "grupo"
  // = categoria PS- (Filtros, Lubrificantes, etc.).
  // Inclui `projetado` por produto — extrapola faturamento até fim do período via
  // smoothedProjection sobre a série diária do produto. Pode ser ruidoso pra
  // SKUs com vendas esporádicas — usar como referência.
  const produtosAsCatalog = useMemo<CatalogProduct[]>(() => {
    if (!computed) return []
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const dias = projectionMeta?.daysRemaining ?? 0

    // Série diária por produto pra projeção — uma passada em vendaItens
    const serieByProduto = new Map<number, Map<string, number>>()
    for (const item of vendaItens) {
      if (!item.dataMovimento) continue
      const day = item.dataMovimento.substring(0, 10)
      const s = serieByProduto.get(item.produtoCodigo) ?? new Map<string, number>()
      s.set(day, (s.get(day) ?? 0) + item.totalVenda)
      serieByProduto.set(item.produtoCodigo, s)
    }

    return computed.produtosVendidos.map((p) => {
      const precoMedioVenda = p.quantidade > 0 ? p.faturamento / p.quantidade : 0
      const custoMedio = p.quantidade > 0 ? p.custo / p.quantidade : 0
      const margemPct = p.faturamento > 0 ? ((p.faturamento - p.custo) / p.faturamento) * 100 : 0
      const serie = serieByProduto.get(p.produtoCodigo) ?? new Map<string, number>()
      const projetado = smoothedProjection({
        realizado: p.faturamento,
        dailySeries: Array.from(serie.entries()).map(([data, value]) => ({ data, value })),
        diasRestantes: dias,
        today: todayISO,
      }).projetado
      return {
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.categoria,
        grupoCodigo: 0, // não usado pelos componentes — só `grupo` (string)
        referencia: p.referencia,
        precoMedioVenda,
        custoMedio,
        margemPct,
        qtdVendida: p.quantidade,
        faturamento: p.faturamento,
        ativo: true,
        unidade: '',
        saldo: estoquePorProduto.get(p.produtoCodigo),
        projetado,
      }
    })
  }, [computed, estoquePorProduto, vendaItens, projectionMeta])

  const gruposListPista = useMemo(() => computed?.categorias.map((c) => c.nome) ?? [], [computed])

  // Aplica busca + filtro de categoria + filtro de estoque na lista de produtos.
  const produtosFiltrados = useMemo(() => {
    if (!computed) return []
    const q = searchProduto.trim().toLowerCase()
    // Classificador inline pro filtro de estoque (mesmas faixas da CoberturaBadge).
    const status = (saldo: number | undefined, qtd: number): 'sem-dados' | 'sem-estoque' | 'critico' | 'atencao' | 'ok' => {
      if (saldo === undefined) return 'sem-dados'
      if (saldo === 0) return 'sem-estoque'
      if (qtd <= 0) return 'ok'
      const d = (saldo * diasPeriodo) / qtd
      if (d < 7) return 'critico'
      if (d < 30) return 'atencao'
      return 'ok'
    }
    return computed.produtosVendidos.filter((p) => {
      if (categoriaFiltro !== 'todas' && p.categoria !== categoriaFiltro) return false
      if (q && !p.nome.toLowerCase().includes(q)) return false
      if (estoqueFiltro !== 'todos') {
        if (status(estoquePorProduto.get(p.produtoCodigo), p.quantidade) !== estoqueFiltro) return false
      }
      return true
    })
  }, [computed, searchProduto, categoriaFiltro, estoqueFiltro, estoquePorProduto, diasPeriodo])

  // Tem filtro ativo? Define se mostramos top-20 ou todos os resultados.
  const hasProductFilter = searchProduto.trim() !== '' || categoriaFiltro !== 'todas' || estoqueFiltro !== 'todos'
  const produtosExibidos = hasProductFilter ? produtosFiltrados : produtosFiltrados.slice(0, 20)
  const categoriasDisponiveis = computed?.categorias.map((c) => c.nome) ?? []

  // Subconjunto pra alimentar o modal — produtos da categoria + vendas brutas
  // pra computar a distribuição diária dentro do modal.
  const categoriaAtual = catNav.current
  const produtosDaCategoria = useMemo(() => {
    if (!categoriaAtual || !computed) return []
    return computed.produtosVendidos.filter((p) => p.categoria === categoriaAtual.nome)
  }, [categoriaAtual, computed])

  const vendasDaCategoria = useMemo(() => {
    if (!categoriaAtual || produtosDaCategoria.length === 0) return []
    const codes = new Set(produtosDaCategoria.map((p) => p.produtoCodigo))
    return vendaItens.filter((v) => codes.has(v.produtoCodigo))
  }, [categoriaAtual, produtosDaCategoria, vendaItens])

  /* ─── Projeção (faturamento + lucro) ───
   * Agrega vendaItens dos produtos PS- por dia e aplica smoothedProjection
   * com `projectionMeta.daysRemaining`. Mesma técnica da Visão Geral. */
  const projecaoPista = useMemo(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    // Projeta SEMPRE até o fim do mês (apurados + dias faltantes, hoje incluso).
    const monthEnd = fimDoMesIso(dataInicial || todayISO)
    const realizadoFat = computed?.kpis.faturamento ?? 0
    const realizadoLucro = computed?.kpis.margem ?? 0

    const fatDaily = new Map<string, number>()
    const lucroDaily = new Map<string, number>()
    if (computed && produtosData && gruposData) {
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      const psCodigos = new Set(
        produtosData
          .filter((p) => classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'automotivos')
          .map((p) => p.produtoCodigo),
      )
      for (const item of vendaItens) {
        if (psCodigos.has(item.produtoCodigo) && item.dataMovimento) {
          const date = item.dataMovimento.substring(0, 10)
          fatDaily.set(date, (fatDaily.get(date) ?? 0) + item.totalVenda)
          lucroDaily.set(date, (lucroDaily.get(date) ?? 0) + (item.totalVenda - item.totalCusto))
        }
      }
    }
    const pf = projecaoAvancada({
      dailySeries: Array.from(fatDaily.entries()).map(([data, value]) => ({ data, value })),
      today: todayISO,
      dataFinal: monthEnd,
    })
    const pl = projecaoAvancada({
      dailySeries: Array.from(lucroDaily.entries()).map(([data, value]) => ({ data, value })),
      today: todayISO,
      dataFinal: monthEnd,
    })
    // Ritmo (pace) do faturamento pra extrapolar métricas de volume (unidades,
    // SKUs distintos) que não têm série diária dedicada. Aproximação "no ritmo
    // atual" — coerente com a projeção de faturamento.
    const scale = realizadoFat > 0 ? pf.esperado / realizadoFat : 1
    const realizadoUnidades = computed?.kpis.unidadesVendidas ?? 0
    const realizadoProdutos = computed?.kpis.produtosDistintos ?? 0
    return {
      fat: pf,
      realizadoFat,
      realizadoLucro,
      projetadoFat: pf.esperado,
      projetadoLucro: pl.esperado,
      projetadoMargemPct: pf.esperado > 0 ? (pl.esperado / pf.esperado) * 100 : 0,
      projetadoUnidades: Math.round(realizadoUnidades * scale),
      projetadoProdutos: Math.round(realizadoProdutos * scale),
      isProjetada: pf.diasRestantes > 0,
      dataFinalProjecao: monthEnd,
    }
  }, [computed, vendaItens, produtosData, gruposData, dataInicial])

  return (
    <div className="space-y-6">
      {!embedded && (
        <>
          <PageHeaderTitle placement="header">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
              <Wrench className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                    Vendas · Automotivo{empresaNome ? ` · ${empresaNome}` : ''}
                  </h1>
                  <FocusModeToggle />
                </div>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                  Filtros, óleos, palhetas, aditivos, baterias e acessórios
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
          {/* KPIs principais — 4 cards ocupando a largura toda (estilo Combustível) */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-4">
          <RealizadoChave />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Faturamento"
              help="Receita das vendas de produtos automotivos (pista) no período — base fiscal, vendas autorizadas."
              value={isLoadingVendas ? '—' : formatCurrencyInt(cmpKpis.atual.faturamento)}
              Icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
              current={cmpKpis.atual.faturamento}
              previous={cmpKpis.prev.faturamento > 0 ? cmpKpis.prev.faturamento : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoPista.isProjetada && computed ? formatCurrencyInt(projecaoPista.projetadoFat) : undefined}
              extra={
                !isLoadingVendas && cmpKpis.prev.faturamento > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrencyInt(cmpKpis.prev.faturamento)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Lucro bruto"
              help="Faturamento − custo (CMV) dos produtos automotivos no período."
              value={isLoadingVendas ? '—' : formatCurrencyInt(cmpKpis.atual.lucroBruto)}
              Icon={DollarSign}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
              current={cmpKpis.atual.lucroBruto}
              previous={cmpKpis.prev.lucroBruto > 0 ? cmpKpis.prev.lucroBruto : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoPista.isProjetada && computed ? formatCurrencyInt(projecaoPista.projetadoLucro) : undefined}
              extra={
                !isLoadingVendas && cmpKpis.prev.lucroBruto > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrencyInt(cmpKpis.prev.lucroBruto)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Margem"
              help="(Lucro bruto ÷ faturamento) × 100."
              value={isLoadingVendas ? '—' : `${cmpKpis.atual.margemPct.toFixed(2).replace('.', ',')}%`}
              Icon={PieChart}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              cardBg="bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
              current={cmpKpis.atual.margemPct}
              previous={cmpKpis.prev.margemPct > 0 ? cmpKpis.prev.margemPct : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoPista.isProjetada && computed ? `${projecaoPista.projetadoMargemPct.toFixed(2).replace('.', ',')}%` : undefined}
              extra={
                !isLoadingVendas && cmpKpis.prev.margemPct > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {cmpKpis.prev.margemPct.toFixed(2).replace('.', ',')}%
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            <KpiCard
              label="Ticket médio"
              help="Faturamento ÷ número de vendas (cupons) com produto de pista no período."
              value={isLoadingVendas ? '—' : formatCurrency(cmpKpis.atual.ticketMedio)}
              hint="Faturamento ÷ nº de vendas"
              Icon={Receipt}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
              current={cmpKpis.atual.ticketMedio}
              previous={cmpKpis.prev.ticketMedio > 0 ? cmpKpis.prev.ticketMedio : undefined}
              comparisonLabel={cmpLabel}
              projecao={projecaoPista.isProjetada && cmpKpis.atual.ticketMedio > 0 ? formatCurrency(cmpKpis.atual.ticketMedio) : undefined}
              extra={
                !isLoadingVendas && cmpKpis.prev.ticketMedio > 0 ? (
                  <div className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>{cmpLabel === 'ano ant.' ? 'Ano anterior' : 'Mês anterior'}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatCurrency(cmpKpis.prev.ticketMedio)}
                      </span>
                    </div>
                  </div>
                ) : null
              }
            />
            </div>
            </div>
            <ProjecaoExecutiva
              fat={projecaoPista.fat}
              projetadoLucro={projecaoPista.projetadoLucro}
              dataFinal={projecaoPista.dataFinalProjecao}
              loading={isLoadingVendas}
            />
          </div>

          {/* Detalhamento de informações — UM card só (igual Combustível):
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

            {/* ── Aba: Realizado dia a dia (clique abre detalhe do dia) ── */}
            {activeTab === 'diadia' && (
              <>
              {semanas.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400">Sem vendas no período.</div>
              ) : (
                <>
                <WeekNav weeks={semanas} activeIdx={activeWeekIdx} onSelect={setActiveMonday} />
                <div className={cn('overflow-x-auto', semanas.length <= 1 && 'pt-3')}>
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-1.5" />
                        <GroupTh first label="Operação" colSpan={1} />
                        <GroupTh label="Financeiro" colSpan={4} />
                        <GroupTh label="Eficiência" colSpan={3} />
                      </tr>
                      <tr>
                        <HeaderHint align="left" label="Data" help="Dia do movimento (data fiscal)." />
                        <HeaderHint label="Qtde" help="Quantidade de itens automotivos vendidos no dia." />
                        <HeaderHint groupStart label="Faturamento" help="Receita das vendas de produtos automotivos no dia (R$)." />
                        <HeaderHint label="Custo" help="CMV (Custo da Mercadoria Vendida) = preço de custo × quantidade vendida. É o que você pagou pelos produtos vendidos — base do lucro bruto e da margem." />
                        <HeaderHint label="Lucro Bruto" help="Faturamento − Custo (CMV) do dia." />
                        <HeaderHint label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
                        <HeaderHint groupStart label="Preço médio" help="Preço de venda médio por unidade: faturamento ÷ quantidade." />
                        <HeaderHint label="Custo médio" help="Custo médio por unidade: CMV ÷ quantidade (custo unitário, não o total)." />
                        <HeaderHint label="L.B. Médio" help="Lucro bruto médio por unidade: preço médio − custo médio." />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {(() => {
                        const dias: PistaDiaData[] = (semanaAtiva?.days ?? []).map((d) => ({
                          data: d.data, qtd: d.qtd, fat: d.fat, custo: d.custo, lucro: d.lucro,
                          grupos: d.grupos.map((g) => ({ nome: g.nome, qtd: g.qtd, fat: g.fat, custo: g.custo, lucro: g.lucro })),
                        }))
                        return dias.map((d, idx) => (
                        <tr
                          key={d.data}
                          className="cursor-pointer text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/40"
                          onClick={() => diaNav.open(dias, idx)}
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
                        ))
                      })()}
                      {/* Subtotal da SEMANA visível + Total do PERÍODO (discreto) */}
                      {semanaAtiva && (() => {
                        const sub = semanaAtiva.days.reduce(
                          (a, d) => ({ qtd: a.qtd + d.qtd, fat: a.fat + d.fat, custo: a.custo + d.custo, lucro: a.lucro + d.lucro }),
                          { qtd: 0, fat: 0, custo: 0, lucro: 0 },
                        )
                        const tot = realizadoDiaADia.total
                        return (
                          <>
                            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                              <td className="px-3 py-2.5">Semana <span className="ml-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{weekChipLabel(semanaAtiva.min, semanaAtiva.max)}</span></td>
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
              )}
              </>
            )}

            {/* Abas extras — Pareto / Curva ABC / Catálogo reusam componentes da Conveniência */}
            {activeTab === 'pareto' && (
              <div className="p-4">
                <Suspense fallback={<RouteFallback />}>
                  <ParetoAnalysis products={produtosAsCatalog} />
                </Suspense>
              </div>
            )}
            {activeTab === 'abc' && (
              <div className="p-4">
                <Suspense fallback={<RouteFallback />}>
                  <CurvaABC products={produtosAsCatalog} />
                </Suspense>
              </div>
            )}
            {activeTab === 'catalogo' && (
              <div className="p-4">
                {!single1Posto && (
                  <p className="mb-3 text-[11px] text-gray-400 dark:text-gray-500">
                    Visão consolidada da rede. O saldo de estoque (snapshot por-posto) aparece ao selecionar 1 posto.
                  </p>
                )}
                <Suspense fallback={<RouteFallback />}>
                  <ProductCatalog products={produtosAsCatalog} gruposList={gruposListPista} />
                </Suspense>
              </div>
            )}

            {/* Aba Realizado por grupo — Por categoria + Top 20 produtos (flush no card) */}
            {activeTab === 'grupo' && (
            <>

          {/* Por categoria — table com BarCells, tooltips, Trophy/Lanterna e Total */}
          <div>
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Por categoria</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Performance agregada dos grupos PS- por família de produto
              </p>
            </div>
            {isLoadingVendas ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : !computed || computed.categorias.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">
                Nenhuma venda de produto automotivo no período.
              </div>
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
                      <HeaderHint align="left" label="Categoria" help="Família agregada dos grupos PS- (filtros, lubrificantes, palhetas, etc.)." />
                      <HeaderHint label="Qtde" help="Total de unidades vendidas na categoria." />
                      <HeaderHint groupStart label="Faturamento" help="Receita total da categoria (R$)." />
                      <HeaderHint label="Custo" help="Custo total da categoria (R$)." />
                      <HeaderHint label="Lucro Bruto" help="Lucro bruto total: faturamento − custo (R$)." />
                      <HeaderHint label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
                      <HeaderHint groupStart label="Preço médio" help="Preço médio de venda por unidade: faturamento ÷ unidades." />
                      <HeaderHint label="Custo médio" help="Custo médio por unidade: custo ÷ unidades." />
                      <HeaderHint label="L.B. Médio" help="Lucro bruto médio por unidade: lucro ÷ unidades." />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(() => {
                      const cats = computed.categorias
                      const maxQtd = Math.max(...cats.map((c) => c.qtdVendida), 0)
                      const maxFat = Math.max(...cats.map((c) => c.faturamento), 0)
                      const maxLucro = Math.max(...cats.map((c) => c.faturamento - c.custo), 0)
                      const maxMargem = Math.max(...cats.map((c) => (c.faturamento > 0 ? ((c.faturamento - c.custo) / c.faturamento) * 100 : 0)), 0)
                      const maxLbMedio = Math.max(...cats.map((c) => (c.qtdVendida > 0 ? (c.faturamento - c.custo) / c.qtdVendida : 0)), 0)
                      const totFat = cats.reduce((s, c) => s + c.faturamento, 0)
                      const totUnid = cats.reduce((s, c) => s + c.qtdVendida, 0)
                      const totCusto = cats.reduce((s, c) => s + c.custo, 0)
                      const totLucro = cats.reduce((s, c) => s + (c.faturamento - c.custo), 0)
                      const totMargemPct = totFat > 0 ? (totLucro / totFat) * 100 : 0
                      return (
                        <>
                          {cats.map((c, idx) => {
                            const lucro = c.faturamento - c.custo
                            const margemPct = c.faturamento > 0 ? (lucro / c.faturamento) * 100 : 0
                            return (
                              <tr
                                key={c.nome}
                                className="cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                                onClick={() => catNav.open(cats, idx)}
                              >
                                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium underline-offset-4 group-hover:underline',
                                        CATEGORIA_COLOR[c.nome] ?? CATEGORIA_COLOR['Outros'],
                                      )}
                                    >
                                      {c.nome}
                                    </span>
                                    {idx === 0 && cats.length > 1 && (
                                      <span
                                        className="inline-flex shrink-0"
                                        title="Categoria com maior faturamento"
                                        aria-label="Categoria com maior faturamento"
                                      >
                                        <Trophy className="h-3 w-3 text-amber-500" />
                                      </span>
                                    )}
                                    {idx === cats.length - 1 && cats.length > 1 && (
                                      <span
                                        className="inline-flex shrink-0"
                                        title="Categoria com menor faturamento"
                                        aria-label="Categoria com menor faturamento"
                                      >
                                        <TrendingDown className="h-3 w-3 text-red-500" />
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={c.qtdVendida} max={maxQtd} formatted={formatNumber(Math.round(c.qtdVendida))} color="blue" align="near" />
                                </td>
                                <td className="border-l border-gray-200 px-2 py-1 dark:border-gray-700">
                                  <BarCell value={c.faturamento} max={maxFat} formatted={formatCurrencyInt(c.faturamento)} color="green" align="near" />
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(c.custo)}</td>
                                <td className="px-2 py-1">
                                  <BarCell value={lucro} max={maxLucro} formatted={formatCurrencyInt(lucro)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={margemPct} max={maxMargem} formatted={`${margemPct.toFixed(2).replace('.', ',')}%`} color="amber" align="near" />
                                </td>
                                <td className="border-l border-gray-200 px-3 py-2 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">{c.qtdVendida > 0 ? formatCurrency(c.faturamento / c.qtdVendida) : '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{c.qtdVendida > 0 ? formatCurrency(c.custo / c.qtdVendida) : '—'}</td>
                                <td className="px-2 py-1">
                                  <BarCell value={c.qtdVendida > 0 ? lucro / c.qtdVendida : 0} max={maxLbMedio} formatted={c.qtdVendida > 0 ? formatCurrency(lucro / c.qtdVendida) : '—'} color="amber" align="near" />
                                </td>
                              </tr>
                            )
                          })}
                          {/* Linha Total */}
                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                            <td className="px-4 py-2.5">Total</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(Math.round(totUnid))}</td>
                            <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(totFat)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(totCusto)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(totLucro)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{totMargemPct.toFixed(2).replace('.', ',')}%</td>
                            <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{totUnid > 0 ? formatCurrency(totFat / totUnid) : '—'}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{totUnid > 0 ? formatCurrency(totCusto / totUnid) : '—'}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{totUnid > 0 ? formatCurrency(totLucro / totUnid) : '—'}</td>
                          </tr>
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabela de produtos com busca + filtro de categoria + BarCells */}
          <div className="border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {hasProductFilter ? 'Produtos' : 'Top 20 produtos'}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {hasProductFilter
                    ? `${produtosFiltrados.length} resultado${produtosFiltrados.length === 1 ? '' : 's'}`
                    : 'Produtos mais vendidos no período (por faturamento)'}
                </p>
              </div>
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchProduto}
                    onChange={(e) => setSearchProduto(e.target.value)}
                    placeholder="Buscar produto..."
                    className="h-8 w-[180px] rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="todas">Todas as categorias</option>
                  {categoriasDisponiveis.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={estoqueFiltro}
                  onChange={(e) => setEstoqueFiltro(e.target.value as typeof estoqueFiltro)}
                  className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  title="Filtra pela cobertura de estoque"
                >
                  <option value="todos">Todos estoques</option>
                  <option value="critico">🔴 Crítico (&lt; 7d)</option>
                  <option value="atencao">🟠 Atenção (7–30d)</option>
                  <option value="ok">🟢 OK (&gt; 30d)</option>
                  <option value="sem-estoque">⚫ Sem estoque</option>
                  <option value="sem-dados">— Sem dados</option>
                </select>
              </div>
            </div>
            {isLoadingVendas ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : produtosExibidos.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">
                {hasProductFilter
                  ? 'Nenhum produto pros filtros aplicados.'
                  : 'Nenhum produto vendido no período.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <HeaderHint align="left" label="Ref." help="Código de referência (SKU) do produto." />
                      <HeaderHint align="left" label="Produto" help="Nome do produto vendido." />
                      <HeaderHint align="left" label="Categoria" help="Família PS- (filtros, lubrificantes, etc.)." />
                      <HeaderHint label="Unidades" help="Quantidade total de unidades vendidas." />
                      <HeaderHint label="Cobertura" help="Dias de estoque restantes: saldo atual ÷ venda diária média do período." />
                      <HeaderHint label="Faturamento" help="Receita total do produto (R$)." />
                      <HeaderHint label="Projeção" help={PROJECAO_TOOLTIP_PRODUTO} />
                      <HeaderHint label="Lucro bruto" help="Lucro bruto total: faturamento − custo (R$)." />
                      <HeaderHint label="Margem %" help="(Lucro bruto ÷ faturamento) × 100." />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(() => {
                      const projByCodigo = new Map(produtosAsCatalog.map((p) => [p.produtoCodigo, p.projetado ?? p.faturamento]))
                      const isProjetadaProd = (projectionMeta?.daysRemaining ?? 0) > 0
                      const maxUnidades = Math.max(...produtosExibidos.map((p) => p.quantidade), 0)
                      const maxFat = Math.max(...produtosExibidos.map((p) => p.faturamento), 0)
                      const maxProjProd = Math.max(...produtosExibidos.map((p) => projByCodigo.get(p.produtoCodigo) ?? 0), 0)
                      const maxLucro = Math.max(...produtosExibidos.map((p) => p.faturamento - p.custo), 0)
                      const maxMargem = Math.max(...produtosExibidos.map((p) => (p.faturamento > 0 ? ((p.faturamento - p.custo) / p.faturamento) * 100 : 0)), 0)
                      const totUnid = produtosExibidos.reduce((s, p) => s + p.quantidade, 0)
                      const totFat = produtosExibidos.reduce((s, p) => s + p.faturamento, 0)
                      const totProjProd = produtosExibidos.reduce((s, p) => s + (projByCodigo.get(p.produtoCodigo) ?? p.faturamento), 0)
                      const totLucro = produtosExibidos.reduce((s, p) => s + (p.faturamento - p.custo), 0)
                      const totMargemPct = totFat > 0 ? (totLucro / totFat) * 100 : 0
                      return (
                        <>
                          {produtosExibidos.map((p) => {
                            const lucro = p.faturamento - p.custo
                            const margemPct = p.faturamento > 0 ? (lucro / p.faturamento) * 100 : 0
                            const rowSelected = selectedProduto === p.produtoCodigo
                            return (
                              <tr
                                key={p.produtoCodigo}
                                onClick={() => toggleProdutoSelected(p.produtoCodigo)}
                                aria-selected={rowSelected}
                                className={cn(
                                  'cursor-pointer transition-colors',
                                  rowSelected
                                    ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                                )}
                              >
                                <td className="px-3 py-2 font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">{p.referencia || '—'}</td>
                                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                  <span className="block max-w-md truncate" title={p.nome}>{p.nome}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                                      CATEGORIA_COLOR[p.categoria] ?? CATEGORIA_COLOR['Outros'],
                                    )}
                                  >
                                    {p.categoria}
                                  </span>
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={p.quantidade} max={maxUnidades} formatted={formatNumber(p.quantidade)} color="blue" align="near" />
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <CoberturaBadge
                                    saldo={estoquePorProduto.get(p.produtoCodigo)}
                                    quantidade={p.quantidade}
                                    diasPeriodo={diasPeriodo}
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={p.faturamento} max={maxFat} formatted={formatCurrencyInt(p.faturamento)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  {(() => {
                                    const proj = projByCodigo.get(p.produtoCodigo) ?? p.faturamento
                                    return <BarCell value={proj} max={maxProjProd} formatted={formatCurrencyInt(proj)} color={isProjetadaProd ? 'blue' : 'green'} align="near" />
                                  })()}
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={lucro} max={maxLucro} formatted={formatCurrencyInt(lucro)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={margemPct} max={maxMargem} formatted={`${margemPct.toFixed(2).replace('.', ',')}%`} color="amber" align="near" />
                                </td>
                              </tr>
                            )
                          })}
                          {/* Linha Total */}
                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                            <td className="px-3 py-2.5" />
                            <td className="px-4 py-2.5">Total</td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totUnid)}</td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(totFat)}</td>
                            <td className={cn(
                              'px-4 py-2.5 text-right tabular-nums',
                              isProjetadaProd && 'text-blue-700 dark:text-blue-400',
                            )}>
                              {formatCurrencyInt(totProjProd)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyInt(totLucro)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{totMargemPct.toFixed(2).replace('.', ',')}%</td>
                          </tr>
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          </>
          )}
          {/* fim do activeTab === 'grupo' */}
          </section>
        </>
      )}

      {/* Modal ao clicar numa linha da seção "Por categoria":
          indicadores + top produtos + distribuição diária da categoria. */}
      <CategoriaDetalheModal
        open={catNav.isOpen}
        onClose={catNav.close}
        categoria={catNav.current}
        produtos={produtosDaCategoria}
        vendasDaCategoria={vendasDaCategoria}
        estoquePorProduto={estoquePorProduto}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        categoriaColorClass={
          catNav.current
            ? CATEGORIA_COLOR[catNav.current.nome] ?? CATEGORIA_COLOR['Outros']
            : ''
        }
        onPrev={catNav.prev}
        onNext={catNav.next}
        canPrev={catNav.canPrev}
        canNext={catNav.canNext}
        position={catNav.position}
      />

      <PistaDiaModal
        open={diaNav.isOpen}
        onClose={diaNav.close}
        detail={diaNav.current}
        onPrev={diaNav.prev}
        onNext={diaNav.next}
        canPrev={diaNav.canPrev}
        canNext={diaNav.canNext}
        position={diaNav.position}
      />
    </div>
  )
}

export default ComercialVendasPista
