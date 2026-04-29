import { useMemo } from 'react'
import { useQueries, useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutoEstoque, fetchEstoquePeriodo } from '@/api/endpoints/estoques'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Produto } from '@/api/types/produto'
import type { ProdutoEstoque, EstoquePeriodo } from '@/api/types/estoque'
import type { VendaItem } from '@/api/types/venda'

export interface ProductAnalyticsRow {
  produtoCodigo: number
  produtoNome: string
  categoria: string
  codigoSku: string
  /** Saldo atual (soma de todos os locais) */
  saldoAtual: number
  /** Custo médio unitário (a partir das vendas dos últimos 6 meses) */
  custoMedio: number
  /** Preço médio de venda unitário (últimos 6 meses) */
  precoMedioVenda: number
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

  // Estoque atual (saldo de cada produto por local)
  const { data: produtoEstoqueData, isLoading: isLoadingEstoque } = useQuery({
    queryKey: ['produtoEstoqueAll', empresaCodigo],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutoEstoque({ empresaCodigo: empresaCodigo!, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: hasEmpresa,
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

  // VendaItens últimos 6 meses — uma query por mês (paralelas, cacheadas individualmente).
  // Usa "vendaItensAll" pra alinhar com o prefetch paginado e evitar colisão
  // com a versão sem paginação que retorna PaginatedResponse.
  const vendaItensQueries = useQueries({
    queries: months.map((m) => ({
      queryKey: ['vendaItensAll', empresaCodigo, m.inicial, m.final],
      queryFn: () => fetchAllPages(
        (p) => fetchVendaItens({ empresaCodigo: empresaCodigo!, dataInicial: m.inicial, dataFinal: m.final, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50,
      ),
      enabled: hasEmpresa,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isLoadingVendas = vendaItensQueries.some((q) => q.isLoading)
  const isLoading = isLoadingEstoque || isLoadingPeriodo || isLoadingVendas

  // Chave estável para useMemo: muda só quando algum dos meses retorna dados novos
  const vendasUpdateKey = vendaItensQueries.map((q) => q.dataUpdatedAt).join('-')
  const allItens = useMemo<VendaItem[]>(
    () => vendaItensQueries.flatMap((q) => q.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendasUpdateKey],
  )

  const computed = useMemo(() => {
    const produtos: Produto[] = produtosData ?? []
    const grupos = gruposData ?? []

    const produtoMap = new Map<number, Produto>()
    for (const p of produtos) produtoMap.set(p.produtoCodigo, p)

    const grupoMap = new Map<number, string>()
    for (const g of grupos) grupoMap.set(g.grupoCodigo, g.nome)

    // Saldo atual por produto (somado por todos os locais)
    const estoqueRaw: ProdutoEstoque[] = Array.isArray(produtoEstoqueData) ? produtoEstoqueData : []
    const saldoAtualMap = new Map<number, number>()
    for (const pe of estoqueRaw) {
      const total = pe.saldoEstoque && pe.saldoEstoque.length > 0
        ? pe.saldoEstoque.reduce((s, se) => s + se.quantidade, 0)
        : pe.saldo
      saldoAtualMap.set(pe.produtoCodigo, (saldoAtualMap.get(pe.produtoCodigo) ?? 0) + total)
    }

    // Por produto: total quantidade, total receita, total custo (a partir das vendas)
    interface ProductSales {
      quantidade: number
      receita: number
      custoTotal: number
      qtdPorMes: Map<string, number>
    }
    const salesMap = new Map<number, ProductSales>()
    for (const item of allItens) {
      // Pular combustíveis na agregação (extra safety além do filtro de produtos)
      if (item.produtoLmcCodigo > 0) continue
      const acc = salesMap.get(item.produtoCodigo) ?? {
        quantidade: 0,
        receita: 0,
        custoTotal: 0,
        qtdPorMes: new Map<string, number>(),
      }
      acc.quantidade += item.quantidade
      acc.receita += item.totalVenda
      acc.custoTotal += item.totalCusto
      const ym = item.dataMovimento?.substring(0, 7) ?? ''
      if (ym) acc.qtdPorMes.set(ym, (acc.qtdPorMes.get(ym) ?? 0) + item.quantidade)
      salesMap.set(item.produtoCodigo, acc)
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
      acc.byDate.set(date, (acc.byDate.get(date) ?? 0) + ep.quatidadeEstoque)
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
        custoMedio,
        precoMedioVenda,
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
  }, [produtosData, gruposData, produtoEstoqueData, estoquePeriodoData, allItens, periodoInicial, periodoFinal, months, coberturaDias])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
    coberturaDias,
  }
}

export default useEstoqueAnalytics
