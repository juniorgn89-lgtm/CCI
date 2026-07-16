import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore, type ComparisonMode } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoque } from '@/api/endpoints/estoques'
import { saldoAtualPorProduto } from '@/api/helpers/produtoEstoqueSaldo'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { splitPeriodAtToday, type ApuracaoVendaRow } from '@/api/supabase/apuracao'
import { useRedeVendasCache } from '@/pages/Operacao/hooks/useRedeVendasCache'
import { smoothedProjection, projecaoSazonal, fimDoMesIso, movingAverageDailyRate } from '@/lib/projection'
import useProjecaoSazonalPiloto, { EMPTY_FUEL_DAILY } from '@/pages/Comercial/Vendas/useProjecaoSazonalPiloto'
import { type VendaAgg } from '@/pages/Conveniencias/hooks/useVendasCache'
import { offsetPeriod, todayLocal } from '@/lib/period'
import { classifySetor } from '@/lib/setorClassification'

/* ── Types ───────────────────────────────────────────────── */

export interface ConvKpiData {
  faturamento: number
  margem: number
  margemPct: number
  qtdItens: number
  /** Nº de cupons (atendimentos) — denominador do ticket médio. */
  qtdCupons: number
  ticketMedio: number
  totalProdutos: number
  // Mês anterior — base fixa do gráfico de evolução e dos insights (não muda com o toggle).
  prev: {
    faturamento: number
    margem: number
    margemPct: number
    ticketMedio: number
    qtdItens: number
  }
  // Período comparativo — honra o toggle global. Igual a `prev` quando 'prevMonth'.
  comparisonMode: ComparisonMode
  cmp: {
    faturamento: number
    margem: number
    margemPct: number
    ticketMedio: number
    qtdItens: number
  }
}

/** Projeção de vendas do período: extrapola o mês corrente e compara ao mês anterior. */
export interface ProjecaoVendas {
  /** Faturamento projetado pro fim do período (= realizado em meses fechados). */
  faturamento: number
  /** Lucro bruto projetado pro fim do período (= realizado em meses fechados). */
  lucroBruto: number
  /** Ticket médio projetado pro fim do período (faturamento ÷ linhas projetadas). */
  ticketMedio: number
  /** Faturamento do mês anterior (base de comparação). */
  comparativo: number
  /** Variação % do projetado vs mês anterior. */
  variacao: number
  /**
   * True só quando o período tem dias futuros (há o que projetar) — modo
   * "Completo" do mês corrente. Em "Apurado"/"Em andamento" não há futuro, então
   * `faturamento` = realizado e a projeção não é real (a UI avisa o usuário).
   */
  isProjetada: boolean
}

export interface DailyRow {
  data: string
  faturamento: number
  custo: number
  margemRs: number
  margemPct: number
  qtdItens: number
  ticketMedio: number
  [key: string]: unknown
}

/** Um produto vendido num dia específico — usado no modal de detalhe do dia. */
export interface DaySaleProduct {
  produtoCodigo: number
  nome: string
  grupo: string
  quantidade: number
  faturamento: number
  custo: number
  margemRs: number
  margemPct: number
  [key: string]: unknown
}

/**
 * Série diária pro gráfico "Vendas Diárias" cobrindo o período inteiro:
 * dias passados/hoje vêm como `faturamento` (real) e os dias que faltam até o
 * fim do período como `projetado` (média móvel suavizada). `margemRs` só nos
 * dias reais (a linha de margem para em hoje).
 */
export interface DailyChartRow {
  data: string
  faturamento: number | null
  projetado: number | null
  margemRs: number | null
  [key: string]: unknown
}

export interface GroupRow {
  grupoCodigo: number
  nome: string
  faturamento: number
  quantidade: number
  margemTotal: number
  margemPct: number
  [key: string]: unknown
}

export interface RevenueRow {
  mes: string
  faturamento: number
  margem: number
}

export interface CatalogProduct {
  produtoCodigo: number
  nome: string
  grupo: string
  grupoCodigo: number
  /** Código de referência do produto (referenciaCodigo, fallback código externo). */
  referencia: string
  precoMedioVenda: number
  custoMedio: number
  margemPct: number
  qtdVendida: number
  faturamento: number
  ativo: boolean
  unidade: string
  /** Saldo atual em estoque (soma de todos os estoques do posto). Undefined
   * quando o produto não tem registro de estoque (serviços etc.). */
  saldo?: number
  /**
   * Faturamento projetado pro fim do período usando média móvel suavizada
   * dos últimos dias. Igual a `faturamento` quando o período é fechado.
   * Pode ser ruidoso pra produtos com vendas esporádicas (poucos dias com
   * movimento) — usar como referência, não como número exato.
   */
  projetado?: number
  [key: string]: unknown
}

export interface StockItem {
  produtoCodigo: number
  nome: string
  grupo: string
  saldo: number
  custoMedio: number
  valorEstoque: number
  status: 'normal' | 'baixo' | 'zerado'
  [key: string]: unknown
}

export interface TopSellerItem {
  produtoCodigo: number
  nome: string
  grupo: string
  quantidade: number
  faturamento: number
  lucroBruto: number
  participacaoPct: number
}

export interface PerformanceProduct {
  produtoCodigo: number
  nome: string
  grupo: string
  faturamento: number
  quantidade: number
  margemPct: number
  lucroBruto: number
  classificacao: 'alta-margem' | 'alto-volume' | 'baixa-saida'
}

export interface InsightItem {
  type: 'positive' | 'warning' | 'info'
  title: string
  description: string
}

/* ── Helper: previous month range ────────────────────────── */


/** Returns range covering the last N full months before dataInicial */
const getEvolutionRange = (dataInicial: string, months: number) => {
  const d = new Date(dataInicial)
  d.setMonth(d.getMonth() - months)
  const yStart = d.getFullYear()
  const mStart = d.getMonth()
  const first = `${yStart}-${String(mStart + 1).padStart(2, '0')}-01`
  // End = last day of month before the current period's start month
  const end = new Date(dataInicial)
  end.setDate(0) // last day of previous month
  const last = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return { dataInicial: first, dataFinal: last }
}

/* ── Hook ────────────────────────────────────────────────── */

const useConvenienceData = (empresaCodigoOverride?: number | null) => {
  const { empresaCodigos: filterCodes, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  // Posto explícito (telas com seletor) tem prioridade; senão o filtro global.
  const empresaCodigos = empresaCodigoOverride !== undefined
    ? (empresaCodigoOverride !== null ? [empresaCodigoOverride] : [])
    : filterCodes
  const hasEmpresa = empresaCodigos.length > 0
  // Consolidado rede-wide (cache apuracao_vendas). `single1Posto` libera o único
  // bloco por-posto que não consolida: saldo de estoque.
  // "Todos" ([]) = postos PERMITIDOS (não a rede RLS inteira).
  const { data: empresasDataPerm } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasDataPerm?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(empresasPermitidas.map((e) => e.codigo)), [empresasPermitidas])
  // Índice sazonal (dia-da-semana) rede-wide do setor conveniência + total do mês
  // anterior COMPLETO pro badge "vs mês ant." (o `cmp` da tela é PARCIAL, mesmos
  // dias decorridos — inflava a variação contra a projeção do mês cheio). Só nas
  // telas que mostram a projeção (filtro global) — Produtividade passa override e
  // ignora a projeção, então não paga o fetch de 6 meses.
  const sz = useProjecaoSazonalPiloto(EMPTY_FUEL_DAILY, empresaCodigoOverride === undefined, 'conveniencia')
  const single1Posto = empresaCodigos.length === 1
  const empresaEstoque = single1Posto ? empresaCodigos[0] : null
  const isPrevYear = comparisonMode === 'prevYear'
  // Comparativo "mesmos dias decorridos": corta o fim em hoje antes
  // de deslocar, pra mês corrente parcial não comparar contra período cheio do passado.
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const prevMonth = { dataInicial: offsetPeriod(dataInicial, 1), dataFinal: offsetPeriod(fimEfetivo, 1) }
  // Período comparativo do toggle global. 'prevMonth' coincide com prevMonth acima
  // (reaproveita o fetch); 'prevYear' usa o mesmo span 12 meses atrás.
  const cmp = isPrevYear
    ? { dataInicial: offsetPeriod(dataInicial, 12), dataFinal: offsetPeriod(fimEfetivo, 12) }
    : prevMonth
  const evolutionRange = getEvolutionRange(dataInicial, 3) // last 3 months before current period

  // Products (cached) — buscado ANTES do cache de vendas pra montar o set de
  // conveniência (escopa a contagem de cupons do ticket médio).
  const { data: produtosData, isLoading: l3 } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Groups (cached)
  const { data: gruposData, isLoading: l4 } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Produtos de conveniência (não combustível, fora dos grupos PS-) — escopa a
  // contagem de cupons (ticket médio = fat ÷ cupons). Memoizado p/ ref estável.
  const convProdutoCodigos = useMemo(() => {
    const set = new Set<number>()
    if (!produtosData || !gruposData) return set
    const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
    for (const p of produtosData) {
      // Régua: conveniência = tipoGrupo "Conveniência" (exclui combustível, pista e "outros").
      if (classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'conveniencia') set.add(p.produtoCodigo)
    }
    return set
  }, [produtosData, gruposData])

  // Vendas CONSOLIDADAS via cache (apuracao_vendas, setor=conveniencia). Fetch
  // rede-wide (RLS) keyed só pelo range → trocar de posto re-agrega no cliente
  // (instantâneo). Só dias FECHADOS no período corrente; prev/cmp/evo históricos.
  const splitCur = splitPeriodAtToday(dataInicial, dataFinal)
  const curIni = splitCur.closedDays?.dataInicial ?? ''
  const curEnd = splitCur.closedDays?.dataFinal ?? ''
  // Fetch rede-wide COMPARTILHADO (chave canônica) — mesma leitura que Combustível
  // e Automotivo reaproveitam via React Query (ver useRedeVendasCache).
  const { data: curRows = [], isLoading: l1 } = useRedeVendasCache(curIni, curEnd)
  const { data: prevRows = [], isLoading: l2 } = useRedeVendasCache(prevMonth.dataInicial, prevMonth.dataFinal)
  const { data: cmpRows = [] } = useRedeVendasCache(cmp.dataInicial, cmp.dataFinal, { enabled: isPrevYear })
  const { data: evoRows = [], isLoading: l6 } = useRedeVendasCache(evolutionRange.dataInicial, evolutionRange.dataFinal, { staleTime: 10 * 60 * 1000 })

  // Estoque — snapshot POR-POSTO (não consolida na rede); só com 1 posto.
  const { data: estoqueRaw, isLoading: l5 } = useQuery({
    queryKey: ['produtoEstoque', empresaEstoque],
    queryFn: () => fetchProdutoEstoque({
      empresaCodigo: empresaEstoque!,
      limite: 1000,
    }),
    enabled: empresaEstoque !== null,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = l1 || l2 || l6 || l3 || l4 || (single1Posto && l5)

  const computed = useMemo(() => {
    // Vendas vêm do cache (apuracao_vendas), consolidadas rede-wide e filtradas
    // pelo posto selecionado (`[]` = rede; subconjunto = recorte). setor carimbado.
    const matchPosto = (code: number) => empresaCodigos.length === 0 ? permittedCodes.has(code) : empresaCodigos.includes(code)
    const toAggs = (rows: ApuracaoVendaRow[]): VendaAgg[] =>
      rows
        .filter((r) => r.setor === 'conveniencia' && matchPosto(r.empresa_codigo))
        .map((r) => ({
          empresaCodigo: r.empresa_codigo,
          data: r.data,
          produtoCodigo: r.produto_codigo,
          quantidade: r.quantidade,
          totalVenda: r.total_venda,
          totalCusto: r.total_custo,
          linhas: r.linhas,
          cupons: r.cupons ?? 0,
        }))
    const vendaAggs = toAggs(curRows)
    const prevAggs = toAggs(prevRows)
    // Comparativo mode-aware — coincide com prevAggs quando 'mês ant.'
    const cmpAggs = !isPrevYear ? prevAggs : toAggs(cmpRows)
    const histAggs = toAggs(evoRows)
    const produtos = produtosData ?? []
    const grupos = gruposData ?? []
    const estoque = estoqueRaw?.resultados ?? []

    // ── Maps ──
    // grupoMap (nome p/ exibição) + grupoTipo (classificação por tipoGrupo).
    const grupoMap = new Map(grupos.map((g) => [g.grupoCodigo, g.nome]))
    const grupoTipo = new Map(grupos.map((g) => [g.grupoCodigo, g.tipoGrupo]))

    const produtoMap = new Map<number, { nome: string; grupoCodigo: number; ativo: boolean; unidade: string; referencia: string }>()
    for (const p of produtos) {
      // Régua: conveniência = tipoGrupo "Conveniência" (exclui combustível,
      // pista e "outros"). Antes era "não combustível e não PS-".
      if (classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) !== 'conveniencia') continue
      produtoMap.set(p.produtoCodigo, {
        nome: p.nome,
        grupoCodigo: p.grupoCodigo,
        ativo: p.ativo,
        unidade: p.unidadeVenda || 'UN',
        referencia: p.referenciaCodigo || p.produtoCodigoExterno || '',
      })
    }

    const getName = (code: number) => produtoMap.get(code)?.nome ?? `Produto ${code}`
    const getGroup = (code: number) => {
      const gc = produtoMap.get(code)?.grupoCodigo
      return gc ? (grupoMap.get(gc) ?? 'Sem grupo') : 'Sem grupo'
    }
    const getGroupCode = (code: number) => produtoMap.get(code)?.grupoCodigo ?? 0

    // Filter aggregates to non-fuel only (produtoMap exclui combustível + PS-)
    const convAggs = vendaAggs.filter((a) => produtoMap.has(a.produtoCodigo))
    const convPrevAggs = prevAggs.filter((a) => produtoMap.has(a.produtoCodigo))
    const convCmpAggs = cmpAggs.filter((a) => produtoMap.has(a.produtoCodigo))

    // ── Aggregate by product (current) ──
    // `count` soma `linhas` (nº de itens de venda) pra preservar o ticket médio.
    const byProduct = new Map<number, { faturamento: number; quantidade: number; custo: number; count: number }>()
    for (const a of convAggs) {
      const prev = byProduct.get(a.produtoCodigo) ?? { faturamento: 0, quantidade: 0, custo: 0, count: 0 }
      byProduct.set(a.produtoCodigo, {
        faturamento: prev.faturamento + a.totalVenda,
        quantidade: prev.quantidade + a.quantidade,
        custo: prev.custo + a.totalCusto,
        count: prev.count + a.linhas,
      })
    }

    // ── Aggregate prev month by product ──
    const byProductPrev = new Map<number, { faturamento: number; quantidade: number }>()
    for (const a of convPrevAggs) {
      const prev = byProductPrev.get(a.produtoCodigo) ?? { faturamento: 0, quantidade: 0 }
      byProductPrev.set(a.produtoCodigo, {
        faturamento: prev.faturamento + a.totalVenda,
        quantidade: prev.quantidade + a.quantidade,
      })
    }

    // Soma os CUPONS (vendaCodigo distinto) de conveniência: `cupons` é um valor
    // de DIA desnormalizado por linha — deduplica por (empresa, dia) e soma.
    const sumCupons = (aggs: VendaAgg[]): number => {
      const byDay = new Map<string, number>()
      for (const a of aggs) {
        if (a.cupons > 0) byDay.set(`${a.empresaCodigo}|${a.data}`, a.cupons)
      }
      let total = 0
      for (const v of byDay.values()) total += v
      return total
    }
    // Ticket médio = faturamento ÷ CUPONS. Cai pra ÷ linhas quando
    // não há cupons (apuração antiga sem a coluna) — sem quebrar a tela.
    const ticketFromCupons = (fat: number, cupons: number, linhas: number): number =>
      cupons > 0 ? fat / cupons : (linhas > 0 ? fat / linhas : 0)

    // ── KPIs ──
    const totalFat = convAggs.reduce((s, a) => s + a.totalVenda, 0)
    const totalCusto = convAggs.reduce((s, a) => s + a.totalCusto, 0)
    const totalQtd = convAggs.reduce((s, a) => s + a.quantidade, 0)
    const totalLinhas = convAggs.reduce((s, a) => s + a.linhas, 0)
    const totalCupons = sumCupons(convAggs)
    const totalMargem = totalFat - totalCusto
    const margemPct = totalFat > 0 ? (totalMargem / totalFat) * 100 : 0
    const ticketMedio = ticketFromCupons(totalFat, totalCupons, totalLinhas)

    const prevFat = convPrevAggs.reduce((s, a) => s + a.totalVenda, 0)
    const prevCusto = convPrevAggs.reduce((s, a) => s + a.totalCusto, 0)
    const prevQtd = convPrevAggs.reduce((s, a) => s + a.quantidade, 0)
    const prevLinhas = convPrevAggs.reduce((s, a) => s + a.linhas, 0)
    const prevMargemPct = prevFat > 0 ? ((prevFat - prevCusto) / prevFat) * 100 : 0
    const prevTicket = ticketFromCupons(prevFat, sumCupons(convPrevAggs), prevLinhas)

    // Comparativo (mode-aware) — coincide com prev quando 'mês ant.'
    const cmpFat = convCmpAggs.reduce((s, a) => s + a.totalVenda, 0)
    const cmpCusto = convCmpAggs.reduce((s, a) => s + a.totalCusto, 0)
    const cmpQtd = convCmpAggs.reduce((s, a) => s + a.quantidade, 0)
    const cmpLinhas = convCmpAggs.reduce((s, a) => s + a.linhas, 0)
    const cmpMargemPct = cmpFat > 0 ? ((cmpFat - cmpCusto) / cmpFat) * 100 : 0
    const cmpTicket = ticketFromCupons(cmpFat, sumCupons(convCmpAggs), cmpLinhas)

    const kpis: ConvKpiData = {
      faturamento: totalFat,
      margem: totalMargem,
      margemPct,
      qtdItens: totalQtd,
      qtdCupons: totalCupons,
      ticketMedio,
      totalProdutos: byProduct.size,
      prev: {
        faturamento: prevFat,
        margem: prevFat - prevCusto,
        margemPct: prevMargemPct,
        ticketMedio: prevTicket,
        qtdItens: prevQtd,
      },
      comparisonMode,
      cmp: {
        faturamento: cmpFat,
        margem: cmpFat - cmpCusto,
        margemPct: cmpMargemPct,
        ticketMedio: cmpTicket,
        qtdItens: cmpQtd,
      },
    }

    // ── Daily data ──
    // `cupons` é valor de dia (desnormalizado por linha) — dedupe por (dia,empresa).
    const byDay = new Map<string, { faturamento: number; custo: number; qtdItens: number; count: number; cupons: number }>()
    const cuponsDiaEmpresa = new Map<string, Set<number>>()
    for (const a of convAggs) {
      const day = a.data
      const prev = byDay.get(day) ?? { faturamento: 0, custo: 0, qtdItens: 0, count: 0, cupons: 0 }
      let addCupons = 0
      if (a.cupons > 0) {
        let seen = cuponsDiaEmpresa.get(day)
        if (!seen) { seen = new Set(); cuponsDiaEmpresa.set(day, seen) }
        if (!seen.has(a.empresaCodigo)) { seen.add(a.empresaCodigo); addCupons = a.cupons }
      }
      byDay.set(day, {
        faturamento: prev.faturamento + a.totalVenda,
        custo: prev.custo + a.totalCusto,
        qtdItens: prev.qtdItens + a.quantidade,
        count: prev.count + a.linhas,
        cupons: prev.cupons + addCupons,
      })
    }
    const dailyData: DailyRow[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => {
        const margemRs = v.faturamento - v.custo
        return {
          data,
          faturamento: v.faturamento,
          custo: v.custo,
          margemRs,
          margemPct: v.faturamento > 0 ? (margemRs / v.faturamento) * 100 : 0,
          qtdItens: v.qtdItens,
          ticketMedio: ticketFromCupons(v.faturamento, v.cupons, v.count),
        }
      })

    // ── Produtos vendidos por dia (pro modal de detalhe do dia) ──
    // Reaproveita os agregados já em memória — sem nenhuma chamada extra.
    const byDayProduto = new Map<string, Map<number, { quantidade: number; faturamento: number; custo: number }>>()
    for (const a of convAggs) {
      const dayMap = byDayProduto.get(a.data) ?? new Map<number, { quantidade: number; faturamento: number; custo: number }>()
      const p = dayMap.get(a.produtoCodigo) ?? { quantidade: 0, faturamento: 0, custo: 0 }
      p.quantidade += a.quantidade
      p.faturamento += a.totalVenda
      p.custo += a.totalCusto
      dayMap.set(a.produtoCodigo, p)
      byDayProduto.set(a.data, dayMap)
    }
    const salesByDay: Record<string, DaySaleProduct[]> = {}
    for (const [day, dayMap] of byDayProduto) {
      const list: DaySaleProduct[] = []
      for (const [code, v] of dayMap) {
        const margemRs = v.faturamento - v.custo
        list.push({
          produtoCodigo: code,
          nome: getName(code),
          grupo: getGroup(code),
          quantidade: v.quantidade,
          faturamento: v.faturamento,
          custo: v.custo,
          margemRs,
          margemPct: v.faturamento > 0 ? (margemRs / v.faturamento) * 100 : 0,
        })
      }
      list.sort((a, b) => b.faturamento - a.faturamento)
      salesByDay[day] = list
    }

    // ── Produtos por grupo (pro modal de detalhe do grupo) ──
    const byGrupoProduto = new Map<number, Map<number, { quantidade: number; faturamento: number; custo: number }>>()
    for (const a of convAggs) {
      const gc = getGroupCode(a.produtoCodigo)
      const gMap = byGrupoProduto.get(gc) ?? new Map<number, { quantidade: number; faturamento: number; custo: number }>()
      const p = gMap.get(a.produtoCodigo) ?? { quantidade: 0, faturamento: 0, custo: 0 }
      p.quantidade += a.quantidade
      p.faturamento += a.totalVenda
      p.custo += a.totalCusto
      gMap.set(a.produtoCodigo, p)
      byGrupoProduto.set(gc, gMap)
    }
    const productsByGroup: Record<number, DaySaleProduct[]> = {}
    for (const [gc, gMap] of byGrupoProduto) {
      const list: DaySaleProduct[] = []
      for (const [code, v] of gMap) {
        const margemRs = v.faturamento - v.custo
        list.push({
          produtoCodigo: code,
          nome: getName(code),
          grupo: getGroup(code),
          quantidade: v.quantidade,
          faturamento: v.faturamento,
          custo: v.custo,
          margemRs,
          margemPct: v.faturamento > 0 ? (margemRs / v.faturamento) * 100 : 0,
        })
      }
      list.sort((a, b) => b.faturamento - a.faturamento)
      productsByGroup[gc] = list
    }

    // ── Group breakdown ──
    const byGrupo = new Map<number, { faturamento: number; quantidade: number; custo: number }>()
    for (const a of convAggs) {
      const gc = getGroupCode(a.produtoCodigo)
      const prev = byGrupo.get(gc) ?? { faturamento: 0, quantidade: 0, custo: 0 }
      byGrupo.set(gc, {
        faturamento: prev.faturamento + a.totalVenda,
        quantidade: prev.quantidade + a.quantidade,
        custo: prev.custo + a.totalCusto,
      })
    }
    const groupTable: GroupRow[] = Array.from(byGrupo.entries())
      .map(([gc, v]) => ({
        grupoCodigo: gc,
        nome: grupoMap.get(gc) ?? 'Sem grupo',
        faturamento: v.faturamento,
        quantidade: v.quantidade,
        margemTotal: v.faturamento - v.custo,
        margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)

    // ── Monthly evolution (historical + previous + current) ──
    const byMonth = new Map<string, { faturamento: number; custo: number }>()
    const addToMonth = (aggs: typeof convAggs, filterByProdutoMap = false) => {
      for (const a of aggs) {
        if (filterByProdutoMap && !produtoMap.has(a.produtoCodigo)) continue
        const month = a.data.substring(0, 7)
        const prev = byMonth.get(month) ?? { faturamento: 0, custo: 0 }
        byMonth.set(month, {
          faturamento: prev.faturamento + a.totalVenda,
          custo: prev.custo + a.totalCusto,
        })
      }
    }
    addToMonth(histAggs, true)    // historical months (filter non-fuel)
    addToMonth(prevAggs, true)    // previous month (filter non-fuel)
    addToMonth(convAggs, false)   // current period (already filtered)
    const revenueData: RevenueRow[] = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-')
        return {
          mes: `${m}/${y}`,
          faturamento: v.faturamento,
          margem: v.faturamento - v.custo,
        }
      })

    // ── Stock items — calculado ANTES do catálogo pra incluir saldo em cada
    // CatalogProduct (necessário pro badge de cobertura no ProductCatalog). ──
    // Dedup das duplicatas do /PRODUTO_ESTOQUE (somar registros inflava o saldo).
    const estoqueMap = saldoAtualPorProduto(estoque)

    // ── Série diária por produto — necessária pra computar `projetado` em
    // cada CatalogProduct. Reaproveita convAggs já em memória. ──
    const _now = new Date()
    const _todayISO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
    let _diasRestantes = 0
    if (dataInicial <= _todayISO && _todayISO <= dataFinal) {
      const end = new Date(`${dataFinal}T00:00:00`)
      const t = new Date(`${_todayISO}T00:00:00`)
      _diasRestantes = Math.max(0, Math.round((end.getTime() - t.getTime()) / 86_400_000))
    }
    const serieByProduto = new Map<number, Map<string, number>>()
    for (const a of convAggs) {
      const s = serieByProduto.get(a.produtoCodigo) ?? new Map<string, number>()
      s.set(a.data, (s.get(a.data) ?? 0) + a.totalVenda)
      serieByProduto.set(a.produtoCodigo, s)
    }

    // ── Product catalog ──
    const catalogProducts: CatalogProduct[] = Array.from(byProduct.entries())
      .map(([code, v]) => {
        const info = produtoMap.get(code)
        const serie = serieByProduto.get(code) ?? new Map<string, number>()
        const projetado = smoothedProjection({
          realizado: v.faturamento,
          dailySeries: Array.from(serie.entries()).map(([data, value]) => ({ data, value })),
          diasRestantes: _diasRestantes,
          today: _todayISO,
        }).projetado
        return {
          produtoCodigo: code,
          nome: getName(code),
          grupo: getGroup(code),
          grupoCodigo: getGroupCode(code),
          precoMedioVenda: v.quantidade > 0 ? v.faturamento / v.quantidade : 0,
          custoMedio: v.quantidade > 0 ? v.custo / v.quantidade : 0,
          margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
          qtdVendida: v.quantidade,
          faturamento: v.faturamento,
          ativo: info?.ativo ?? true,
          unidade: info?.unidade ?? 'UN',
          referencia: info?.referencia ?? '',
          saldo: estoqueMap.get(code),
          projetado,
        }
      })
      .sort((a, b) => b.faturamento - a.faturamento)

    const stockItems: StockItem[] = []
    for (const [code, saldo] of estoqueMap.entries()) {
      if (!produtoMap.has(code)) continue
      const prod = byProduct.get(code)
      const custoMedio = prod && prod.quantidade > 0 ? prod.custo / prod.quantidade : 0
      stockItems.push({
        produtoCodigo: code,
        nome: getName(code),
        grupo: getGroup(code),
        saldo,
        custoMedio,
        valorEstoque: saldo * custoMedio,
        status: saldo <= 0 ? 'zerado' : saldo <= 5 ? 'baixo' : 'normal',
      })
    }
    stockItems.sort((a, b) => a.status === 'zerado' ? -1 : b.status === 'zerado' ? 1 : a.saldo - b.saldo)

    const stockSummary = {
      totalItens: stockItems.length,
      valorTotal: stockItems.reduce((s, i) => s + i.valorEstoque, 0),
      baixoEstoque: stockItems.filter((i) => i.status === 'baixo').length,
      zerado: stockItems.filter((i) => i.status === 'zerado').length,
    }

    // ── Top sellers ──
    const topSellers: TopSellerItem[] = [...catalogProducts]
      .sort((a, b) => b.qtdVendida - a.qtdVendida)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        quantidade: p.qtdVendida,
        faturamento: p.faturamento,
        lucroBruto: p.faturamento - (p.custoMedio * p.qtdVendida),
        participacaoPct: totalFat > 0 ? (p.faturamento / totalFat) * 100 : 0,
      }))

    // Treemap data (by group)
    const treemapData = groupTable.map((g) => ({
      name: g.nome,
      value: g.faturamento,
      quantidade: g.quantidade,
    }))

    // ── Performance analysis ──
    const allProducts = catalogProducts.map((p) => ({
      ...p,
      lucroBruto: p.faturamento - (p.custoMedio * p.qtdVendida),
    }))

    const highMargin: PerformanceProduct[] = [...allProducts]
      .filter((p) => p.margemPct > 0)
      .sort((a, b) => b.margemPct - a.margemPct)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        faturamento: p.faturamento,
        quantidade: p.qtdVendida,
        margemPct: p.margemPct,
        lucroBruto: p.lucroBruto,
        classificacao: 'alta-margem' as const,
      }))

    const highVolume: PerformanceProduct[] = [...allProducts]
      .sort((a, b) => b.qtdVendida - a.qtdVendida)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        faturamento: p.faturamento,
        quantidade: p.qtdVendida,
        margemPct: p.margemPct,
        lucroBruto: p.lucroBruto,
        classificacao: 'alto-volume' as const,
      }))

    const lowSales: PerformanceProduct[] = [...allProducts]
      .filter((p) => p.qtdVendida > 0)
      .sort((a, b) => a.qtdVendida - b.qtdVendida)
      .slice(0, 10)
      .map((p) => ({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        grupo: p.grupo,
        faturamento: p.faturamento,
        quantidade: p.qtdVendida,
        margemPct: p.margemPct,
        lucroBruto: p.lucroBruto,
        classificacao: 'baixa-saida' as const,
      }))

    // ── Insights ──
    const insights: InsightItem[] = []

    // Top seller insight
    if (topSellers.length > 0) {
      const top = topSellers[0]
      insights.push({
        type: 'positive',
        title: `${top.nome} lidera as vendas`,
        description: `Com ${top.quantidade.toLocaleString('pt-BR')} unidades vendidas, representa ${top.participacaoPct.toFixed(2)}% do faturamento total da conveniência.`,
      })
    }

    // Month-over-month growth
    if (prevFat > 0 && totalFat > 0) {
      const growthPct = ((totalFat - prevFat) / prevFat) * 100
      if (growthPct > 0) {
        insights.push({
          type: 'positive',
          title: `Crescimento de ${growthPct.toFixed(2)}% nas vendas`,
          description: `A conveniência faturou mais neste período comparado ao mês anterior.`,
        })
      } else {
        insights.push({
          type: 'warning',
          title: `Queda de ${Math.abs(growthPct).toFixed(2)}% nas vendas`,
          description: `O faturamento caiu em relação ao mês anterior. Avalie promoções e mix de produtos.`,
        })
      }
    }

    // High margin products
    if (highMargin.length > 0 && highMargin[0].margemPct > 30) {
      insights.push({
        type: 'positive',
        title: `${highMargin[0].nome} tem margem de ${highMargin[0].margemPct.toFixed(2)}%`,
        description: `Produto com excelente rentabilidade. Considere destacá-lo na loja.`,
      })
    }

    // Low sales products
    if (lowSales.length > 0) {
      const lowCount = lowSales.filter((p) => p.quantidade <= 3).length
      if (lowCount > 3) {
        insights.push({
          type: 'warning',
          title: `${lowCount} produtos com baixa rotatividade`,
          description: `Esses produtos tiveram menos de 3 unidades vendidas no período. Revise a estratégia.`,
        })
      }
    }

    // Stock alerts
    if (stockSummary.zerado > 0) {
      insights.push({
        type: 'warning',
        title: `${stockSummary.zerado} produtos com estoque zerado`,
        description: `Produtos sem estoque podem representar perda de vendas. Verifique reposição.`,
      })
    }

    // Best performing group
    if (groupTable.length > 0) {
      const bestGroup = groupTable[0]
      insights.push({
        type: 'info',
        title: `Grupo "${bestGroup.nome}" é o mais rentável`,
        description: `Responsável por R$ ${bestGroup.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em faturamento com margem de ${bestGroup.margemPct.toFixed(2)}%.`,
      })
    }

    // Average ticket insight
    if (ticketMedio > 0) {
      insights.push({
        type: 'info',
        title: `Ticket médio de R$ ${ticketMedio.toFixed(2)}`,
        description: `Cada venda da conveniência gera em média esse valor. Estratégias de cross-selling podem elevar esse indicador.`,
      })
    }

    // Groups list for filters
    const gruposList = [...new Set(catalogProducts.map((p) => p.grupo))].sort()

    // ── Projeção de vendas ──
    // Extrapola o faturamento do mês corrente pelos dias que faltam (média
    // móvel suavizada). Em mês fechado não há dias restantes → projetado =
    // realizado. Compara com o faturamento do mês anterior.
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    // Projeta SEMPRE até o fim do mês (apurados + dias faltantes, hoje incluso
    // como faltante) — independe do escopo Apurado/Em andamento/Completo.
    const monthEnd = fimDoMesIso(dataInicial || todayISO)
    // Sazonal: índice por dia-da-semana do setor conveniência (ramo linear quando
    // < 90d de operação → índices vazio = 1 pra todo dia = monthEndFactor).
    const projFat = projecaoSazonal({
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.faturamento })),
      today: todayISO,
      dataFinal: monthEnd,
      indices: sz.linear ? {} : sz.indices.faturamento,
    })
    const projLucro = projecaoSazonal({
      dailySeries: dailyData.map((d) => ({ data: d.data, value: d.margemRs })),
      today: todayISO,
      dataFinal: monthEnd,
      indices: sz.linear ? {} : sz.indices.lucro,
    })
    // Ticket = faturamento ÷ CUPONS. Projeta os cupons/dia pra derivar o ticket
    // projetado (cai pra linhas quando não há cupons — apuração antiga).
    const temCupons = Array.from(byDay.values()).some((v) => v.cupons > 0)
    const projCount = projecaoSazonal({
      dailySeries: Array.from(byDay.entries()).map(([data, v]) => ({ data, value: temCupons ? v.cupons : v.count })),
      today: todayISO,
      dataFinal: monthEnd,
      // Cupons/dia acompanham o faturamento/dia — reusa o índice de faturamento.
      indices: sz.linear ? {} : sz.indices.faturamento,
    })
    const projetadoFat = projFat.esperado
    const projetadoLucro = projLucro.esperado
    const projecao: ProjecaoVendas = {
      faturamento: projetadoFat,
      lucroBruto: projetadoLucro,
      ticketMedio: projCount.esperado > 0 ? projetadoFat / projCount.esperado : 0,
      comparativo: prevFat,
      variacao: prevFat > 0 ? ((projetadoFat - prevFat) / prevFat) * 100 : 0,
      isProjetada: projFat.diasRestantes > 0,
    }

    // ── Série diária do gráfico (real + projeção dos dias futuros) ──
    const fatRate = movingAverageDailyRate(
      dailyData.map((d) => ({ data: d.data, value: d.faturamento })),
      todayISO,
    )
    const dailyByDate = new Map(dailyData.map((d) => [d.data, d]))
    const dailyChartData: DailyChartRow[] = []
    {
      const s = new Date(`${dataInicial}T00:00:00`)
      const e = new Date(`${dataFinal}T00:00:00`)
      for (const cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        const isFuture = ds > todayISO
        const row = dailyByDate.get(ds)
        dailyChartData.push({
          data: ds,
          faturamento: isFuture ? null : (row?.faturamento ?? 0),
          projetado: isFuture ? fatRate : null,
          margemRs: isFuture ? null : (row?.margemRs ?? 0),
        })
      }
    }

    return {
      kpis,
      projecao,
      /** Resultado completo da projeção de FATURAMENTO (cenários/sparkline/etc) pro card executivo. */
      projecaoFat: projFat,
      /** Comparativo do card = mês anterior COMPLETO (não o `cmp` parcial dos deltas). */
      projComparativo: sz.cmpAnterior.faturamento > 0
        ? { anterior: sz.cmpAnterior.faturamento, label: sz.cmpLabel }
        : undefined,
      dailyData,
      dailyChartData,
      salesByDay,
      productsByGroup,
      groupTable,
      revenueData,
      catalogProducts,
      stockItems,
      stockSummary,
      topSellers,
      treemapData,
      highMargin,
      highVolume,
      lowSales,
      insights,
      gruposList,
    }
  }, [
    curRows, prevRows, cmpRows, evoRows, produtosData, gruposData, estoqueRaw, empresaCodigos, permittedCodes,
    dataInicial, dataFinal, comparisonMode, isPrevYear, convProdutoCodigos, sz,
  ])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
    /** Índice sazonal (dia-da-semana) de FATURAMENTO — pra linha de projeção do
     *  gráfico. `{}` = linear. */
    sazonalFatIndex: sz.linear ? {} : sz.indices.faturamento,
    // Consolidado a partir do cache (apuracao_vendas) — sempre "instantâneo".
    isCacheHit: true,
    // Vendas brutas não são mais expostas (cache é agregado); os modals
    // reagregam a partir de `salesByDay`/`productsByGroup`. Mantido como [] por
    // compatibilidade — já era vazio quando o cache dava HIT.
    vendaItens: [],
  }
}

export default useConvenienceData
