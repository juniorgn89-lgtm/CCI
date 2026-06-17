import { useMemo } from 'react'
import { useQueries, useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutoEstoque, fetchProdutoEstoqueExtrato, fetchEstoquePeriodo } from '@/api/endpoints/estoques'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { saldoAtualPorProduto } from '@/api/helpers/produtoEstoqueSaldo'
import useVendasCache, { aggregateItensToVendaAgg, type VendaAgg } from '@/pages/Conveniencias/hooks/useVendasCache'
import { todayLocal } from '@/lib/period'
import type { Produto } from '@/api/types/produto'
import type { ProdutoEstoque, ProdutoEstoqueExtrato, EstoquePeriodo } from '@/api/types/estoque'
import type { VendaItem } from '@/api/types/venda'

export interface ProductAnalyticsRow {
  produtoCodigo: number
  produtoNome: string
  categoria: string
  codigoSku: string
  /** Saldo atual (soma de todos os locais) */
  saldoAtual: number
  /** Estoque mínimo cadastrado (Qtd. Mín.), do /PRODUTO_ESTOQUE_EXTRATO. */
  estoqueMinimo: number
  /** Custo médio unitário (a partir das vendas dos últimos 6 meses) */
  custoMedio: number
  /** Preço médio de venda unitário (últimos 6 meses) */
  precoMedioVenda: number
  /** Markup % = (preço médio / custo médio − 1) × 100 */
  markup: number
  /** Margem de lucro por unidade (R$) = preço médio − custo médio */
  margemLucroUnit: number
  /** Código de barras (primeiro cadastrado) ou '' */
  codigoBarras: string
  /** Última venda (yyyy-MM-dd) dentro dos últimos 6 meses, ou null */
  ultimaVenda: string | null
  /** Valor em estoque = saldoAtual × custoMedio */
  valorEstoque: number
  /** Total de unidades vendidas nos últimos 6 meses */
  vendasUltimos6m: number
  /** Total de receita nos últimos 6 meses */
  receitaUltimos6m: number
  /** Média mensal de unidades vendidas */
  mediaMensalVendas: number
  /** Mês com maior venda (formato 'YYYY-MM') ou null */
  mesPico: string | null
  /** Quantidade vendida no mês de pico */
  vendasPico: number
  /** Estoque médio nos últimos 6 meses */
  estoqueMedio: number
  /** Giro = vendasUltimos6m / estoqueMedio (unidades vendidas por unidade estocada em 6 meses) */
  giro: number
  /** Cobertura atual em dias (saldoAtual / venda diária média) */
  diasCobertura: number
  /** Quantidade sugerida pra atingir cobertura desejada (em unidades) */
  necessidadeUnidades: number
  /** Status da necessidade */
  necessidadeStatus: 'negativo' | 'critico' | 'baixo' | 'ok' | 'sem_movimento'
  /** Vendas mensais (até 6 entradas), do mais antigo para o mais recente */
  vendasMensais: { mes: string; quantidade: number }[]
  // Index signature exigido pelo DataTable<T extends Record<string, unknown>>
  [key: string]: unknown
}

export interface EstoqueKpis {
  totalProdutos: number
  valorTotalEstoque: number
}

const DAYS_PER_MONTH = 30
const MONTHS_LOOKBACK = 6

const formatYm = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const ymdFirstDay = (y: number, m: number): string => `${y}-${String(m).padStart(2, '0')}-01`
const ymdLastDay = (y: number, m: number): string => {
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

interface MonthRange {
  ym: string
  inicial: string
  final: string
}

const buildLast6Months = (): MonthRange[] => {
  const today = new Date()
  const ranges: MonthRange[] = []
  for (let i = MONTHS_LOOKBACK - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    ranges.push({
      ym: formatYm(d),
      inicial: ymdFirstDay(y, m),
      final: ymdLastDay(y, m),
    })
  }
  return ranges
}

const useEstoqueAnalytics = (coberturaDias: number = DAYS_PER_MONTH) => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  // O saldo de estoque é SEMPRE o ATUAL (igual ao webPosto, cujo "Qtd" não muda
  // com a data do relatório). Não fazemos snapshot histórico por data — a API
  // de estoque não dá um snapshot confiável e o webPosto também ignora a data.

  const months = useMemo(() => buildLast6Months(), [])
  const periodoInicial = months[0].inicial
  const periodoFinal = months[months.length - 1].final

  // Catálogo de produtos (cache compartilhado)
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Grupos (cache compartilhado)
  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Estoque atual (saldo de cada produto por local) — sempre o saldo de agora.
  const { data: produtoEstoqueData, isLoading: isLoadingEstoque } = useQuery({
    queryKey: ['produtoEstoqueAll', empresaCodigo],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutoEstoque({ empresaCodigo: empresaCodigo!, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  // Cadastro do produto por empresa (estoque mínimo/máximo, preço venda/custo)
  // via /PRODUTO_ESTOQUE_EXTRATO. exibeHistoricoCompra=false → payload leve.
  // Supplementar (Qtd. Mín.); não entra no gate de loading.
  const { data: estoqueExtratoData } = useQuery({
    queryKey: ['produtoEstoqueExtrato', empresaCodigo],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutoEstoqueExtrato({ empresaCodigo: empresaCodigo!, exibeHistoricoCompra: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Histórico de estoque por dia/produto nos últimos 6 meses.
  // Usa o mesmo queryKey "estoquePeriodoAll" que o prefetch (compartilha cache)
  // — não pode ser apenas "estoquePeriodo" porque esse já é usado por outro
  // prefetch que retorna PaginatedResponse, causando colisão de tipos.
  const { data: estoquePeriodoData, isLoading: isLoadingPeriodo } = useQuery({
    queryKey: ['estoquePeriodoAll', empresaCodigo, periodoFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchEstoquePeriodo({ dataFinal: periodoFinal, empresaCodigo: empresaCodigo ?? undefined, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  // Venda dos últimos 6 meses — vem do cache Supabase (apuracao_vendas) pros
  // dias FECHADOS apurados + hoje live. Elimina os 6 fetches pesados de
  // venda_item ao vivo. Janela até HOJE (venda não é futura).
  const vendasCache = useVendasCache({
    dataInicial: periodoInicial,
    dataFinal: todayLocal(),
    empresaCodigo,
    empresasPermitidasCount: 1,
  })

  // Fallback LIVE — só quando o cache de vendas dá MISS (mês não apurado ou
  // apuração antiga). Mantém o comportamento legado sem regressão.
  const vendasLiveEnabled = hasEmpresa && !vendasCache.isCacheHit && !vendasCache.isChecking
  const vendaItensQueries = useQueries({
    queries: months.map((m) => ({
      queryKey: ['vendaItensAll', empresaCodigo, m.inicial, m.final],
      queryFn: () => fetchAllPages(
        (p) => fetchVendaItens({ empresaCodigo: empresaCodigo!, dataInicial: m.inicial, dataFinal: m.final, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50,
      ),
      enabled: vendasLiveEnabled,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isLoadingVendas = vendaItensQueries.some((q) => q.isLoading)
  const isLoading =
    isLoadingEstoque ||
    isLoadingPeriodo ||
    vendasCache.isChecking ||
    (!vendasCache.isCacheHit && isLoadingVendas)

  // Chave estável para useMemo: muda só quando algum dos meses retorna dados novos
  const vendasUpdateKey = vendaItensQueries.map((q) => q.dataUpdatedAt).join('-')
  const allItens = useMemo<VendaItem[]>(
    () => vendaItensQueries.flatMap((q) => q.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendasUpdateKey],
  )

  // Fonte única de venda agregada (cache HIT → cache; senão → live agregado no
  // mesmo shape). VendaAgg = { produtoCodigo, data, quantidade, totalVenda,
  // totalCusto, ... } por (empresa, dia, produto).
  const vendaAggs: VendaAgg[] = useMemo(
    () => (vendasCache.isCacheHit ? vendasCache.vendas : aggregateItensToVendaAgg(allItens)),
    [vendasCache.isCacheHit, vendasCache.vendas, allItens],
  )

  const computed = useMemo(() => {
    const produtos: Produto[] = produtosData ?? []
    const grupos = gruposData ?? []

    const produtoMap = new Map<number, Produto>()
    for (const p of produtos) produtoMap.set(p.produtoCodigo, p)

    const grupoMap = new Map<number, string>()
    for (const g of grupos) grupoMap.set(g.grupoCodigo, g.nome)

    // Saldo atual por produto — dedup das duplicatas do /PRODUTO_ESTOQUE.
    const estoqueRaw: ProdutoEstoque[] = Array.isArray(produtoEstoqueData) ? produtoEstoqueData : []
    const saldoAtualMap = saldoAtualPorProduto(estoqueRaw)

    // Estoque mínimo (cadastro) por produto, do /PRODUTO_ESTOQUE_EXTRATO. Dedup
    // por produtoCodigo (valor de cadastro idêntico nas duplicatas).
    const minimoMap = new Map<number, number>()
    for (const e of (estoqueExtratoData ?? []) as ProdutoEstoqueExtrato[]) {
      if (!minimoMap.has(e.produtoCodigo)) minimoMap.set(e.produtoCodigo, e.estoqueMinimo ?? 0)
    }

    // Por produto: total quantidade, total receita, total custo (a partir das vendas)
    interface ProductSales {
      quantidade: number
      receita: number
      custoTotal: number
      qtdPorMes: Map<string, number>
      /** Maior dataMovimento vista (yyyy-MM-dd…) — última venda. */
      ultimaData: string
    }
    // Agrega por produto a partir do VendaAgg (cache ou live, mesmo shape).
    // Combustível é descartado depois (a iteração de produtos pula combustível),
    // então não precisa filtrar aqui.
    const salesMap = new Map<number, ProductSales>()
    for (const v of vendaAggs) {
      const acc = salesMap.get(v.produtoCodigo) ?? {
        quantidade: 0,
        receita: 0,
        custoTotal: 0,
        qtdPorMes: new Map<string, number>(),
        ultimaData: '',
      }
      acc.quantidade += v.quantidade
      acc.receita += v.totalVenda
      acc.custoTotal += v.totalCusto
      const dm = v.data ?? ''
      if (dm && dm > acc.ultimaData) acc.ultimaData = dm
      const ym = dm.substring(0, 7)
      if (ym) acc.qtdPorMes.set(ym, (acc.qtdPorMes.get(ym) ?? 0) + v.quantidade)
      salesMap.set(v.produtoCodigo, acc)
    }

    // Estoque histórico por produto: agrupar por dataMovimento e calcular média
    const periodos: EstoquePeriodo[] = Array.isArray(estoquePeriodoData) ? estoquePeriodoData : []
    interface ProductHistory {
      // Soma de saldos por data (cada data é um snapshot)
      byDate: Map<string, number>
    }
    const historyMap = new Map<number, ProductHistory>()
    for (const ep of periodos) {
      const date = ep.dataMovimento.includes('T') ? ep.dataMovimento.split('T')[0] : ep.dataMovimento
      // Filtrar para últimos 6 meses
      if (date < periodoInicial || date > periodoFinal) continue
      const acc = historyMap.get(ep.codigoProduto) ?? { byDate: new Map<string, number>() }
      // Um snapshot por (produto, data) — last-write-wins dedup. A API repete
      // linhas (mesmo bug do /PRODUTO_ESTOQUE); SOMAR inflaria o estoque médio.
      acc.byDate.set(date, ep.quatidadeEstoque)
      historyMap.set(ep.codigoProduto, acc)
    }

    // Construir analytics: itera produtos do catálogo, gera linha para cada não-combustível com algum dado
    const productAnalytics: ProductAnalyticsRow[] = []
    for (const produto of produtos) {
      // Excluir combustíveis
      if (produto.combustivel || produto.produtoLmcCodigo > 0) continue

      const saldoAtual = saldoAtualMap.get(produto.produtoCodigo) ?? 0
      const sales = salesMap.get(produto.produtoCodigo)
      const history = historyMap.get(produto.produtoCodigo)

      // Skip products with no stock and no sales (provavelmente irrelevantes)
      if (saldoAtual === 0 && !sales && !history) continue

      const vendasUltimos6m = sales?.quantidade ?? 0
      const receitaUltimos6m = sales?.receita ?? 0
      const custoTotalVendas = sales?.custoTotal ?? 0
      const custoMedio = vendasUltimos6m > 0 ? custoTotalVendas / vendasUltimos6m : 0
      const precoMedioVenda = vendasUltimos6m > 0 ? receitaUltimos6m / vendasUltimos6m : 0
      const markup = custoMedio > 0 ? (precoMedioVenda / custoMedio - 1) * 100 : 0
      const margemLucroUnit = precoMedioVenda > 0 ? precoMedioVenda - custoMedio : 0
      const codigoBarras = produto.produtoCodigoBarra?.[0]?.codigoBarra ?? ''
      const ultimaVenda = sales?.ultimaData ? sales.ultimaData.slice(0, 10) : null
      const valorEstoque = saldoAtual * custoMedio
      const mediaMensalVendas = vendasUltimos6m / MONTHS_LOOKBACK

      // Mês de pico
      let mesPico: string | null = null
      let vendasPico = 0
      const vendasMensais: { mes: string; quantidade: number }[] = []
      for (const m of months) {
        const qtd = sales?.qtdPorMes.get(m.ym) ?? 0
        vendasMensais.push({ mes: m.ym, quantidade: qtd })
        if (qtd > vendasPico) {
          vendasPico = qtd
          mesPico = m.ym
        }
      }

      // Estoque médio
      let estoqueMedio = 0
      if (history && history.byDate.size > 0) {
        const values = Array.from(history.byDate.values())
        estoqueMedio = values.reduce((s, v) => s + v, 0) / values.length
      } else {
        // fallback: usa saldo atual
        estoqueMedio = saldoAtual
      }

      // Giro: quantas vezes o estoque "girou" no período de 6 meses
      const giro = estoqueMedio > 0 ? vendasUltimos6m / estoqueMedio : 0

      // Cobertura em dias: saldoAtual / venda diária média
      const vendaDiariaMedia = mediaMensalVendas / DAYS_PER_MONTH
      const diasCobertura = vendaDiariaMedia > 0 ? saldoAtual / vendaDiariaMedia : Infinity

      // Status: identifica primeiro a inconsistência (saldo negativo) — não vira
      // sugestão de compra porque é tipicamente erro de lançamento, não falta de produto.
      let necessidadeStatus: ProductAnalyticsRow['necessidadeStatus']
      if (saldoAtual < 0) {
        necessidadeStatus = 'negativo'
      } else if (vendasUltimos6m === 0) {
        necessidadeStatus = 'sem_movimento'
      } else if (saldoAtual === 0) {
        // Zerado com venda → precisa comprar
        necessidadeStatus = 'critico'
      } else if (diasCobertura < coberturaDias / 2) {
        necessidadeStatus = 'critico'
      } else if (diasCobertura < coberturaDias) {
        necessidadeStatus = 'baixo'
      } else {
        necessidadeStatus = 'ok'
      }

      // Necessidade só aplica pra status acionáveis ('critico'/'baixo'). Negativos
      // não recebem sugestão (corrigir antes); 'sem_movimento' e 'ok' também não.
      const estoqueIdeal = vendaDiariaMedia * coberturaDias
      const necessidadeUnidades = (necessidadeStatus === 'critico' || necessidadeStatus === 'baixo')
        ? Math.max(0, estoqueIdeal - saldoAtual)
        : 0

      productAnalytics.push({
        produtoCodigo: produto.produtoCodigo,
        produtoNome: produto.nome,
        categoria: grupoMap.get(produto.grupoCodigo) ?? 'Outros',
        codigoSku: produto.referenciaCodigo || produto.produtoCodigoExterno || String(produto.produtoCodigo),
        saldoAtual,
        estoqueMinimo: minimoMap.get(produto.produtoCodigo) ?? 0,
        custoMedio,
        precoMedioVenda,
        markup,
        margemLucroUnit,
        codigoBarras,
        ultimaVenda,
        valorEstoque,
        vendasUltimos6m,
        receitaUltimos6m,
        mediaMensalVendas,
        mesPico,
        vendasPico,
        estoqueMedio,
        giro,
        diasCobertura: isFinite(diasCobertura) ? diasCobertura : 0,
        necessidadeUnidades,
        necessidadeStatus,
        vendasMensais,
      })
    }

    // KPIs
    const totalProdutos = productAnalytics.length
    const valorTotalEstoque = productAnalytics.reduce((s, p) => s + p.valorEstoque, 0)
    const kpis: EstoqueKpis = { totalProdutos, valorTotalEstoque }

    const categorias = Array.from(new Set(productAnalytics.map((r) => r.categoria))).sort()

    return { productAnalytics, kpis, categorias, months }
  }, [produtosData, gruposData, produtoEstoqueData, estoqueExtratoData, estoquePeriodoData, vendaAggs, periodoInicial, periodoFinal, months, coberturaDias])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
    coberturaDias,
  }
}

export default useEstoqueAnalytics
