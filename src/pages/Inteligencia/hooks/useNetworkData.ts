import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchAbastecimentos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { buildCostMapFromLmc } from '@/api/supabase/apuracao'
import { offsetPeriod } from '@/lib/period'
import type { Empresa } from '@/api/types/empresa'

/* ── Types ───────────────────────────────────────────────── */

export interface PostoData {
  empresaCodigo: number
  nome: string
  fantasia: string
  cidade: string
  estado: string
  latitude: number
  longitude: number
  receita: number
  litros: number
  abastecimentos: number
  ticketMedio: number
  conversao: number
  produtosVendidos: number
  score: number
  performance: 'above' | 'average' | 'below'
  /** Faturamento de combustível (Σ valorTotal dos abastecimentos). */
  fatCombustivel: number
  /** Preço médio de venda por litro (faturamento combustível ÷ litros). */
  precoLitro: number
  /** Custo médio por litro — só sobre o volume que tem custo apurado (pode ser 0). */
  custoLitro: number
  /** Lucro bruto por litro (preço − custo); 0 quando não há custo apurado. */
  lbLitro: number
  /** Margem % por litro; 0 quando não há custo apurado. */
  margem: number
  /** % dos litros com custo apurado (cobertura) — sinaliza confiabilidade de custo/margem. */
  comCustoPct: number
}

export interface NetworkInsight {
  type: 'positive' | 'warning' | 'info'
  posto: string
  message: string
}

export interface PostoGoal {
  empresaCodigo: number
  nome: string
  goals: {
    label: string
    current: number
    target: number
    percent: number
    unit: string
  }[]
}

export interface ForecastPoint {
  date: string
  real: number
  trend: number | null
  forecast: number | null
}

export interface NetworkAlert {
  type: 'danger' | 'warning' | 'info'
  posto: string
  message: string
}

/* ── Hook ────────────────────────────────────────────────── */

interface UseNetworkDataParams {
  empresaCodigos: number[]
}

const useNetworkData = ({ empresaCodigos }: UseNetworkDataParams) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  // Fetch all empresas (for names, coordinates)
  const { data: empresasRaw } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 100 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresasData = useMemo(() => empresasRaw?.resultados ?? [], [empresasRaw])

  // Fetch venda resumo per company
  const { data: resumoData } = useQuery({
    queryKey: ['vendaResumoNetwork', empresaCodigos, dataInicial, dataFinal],
    queryFn: () => fetchVendaResumo({
      empresaCodigo: empresaCodigos,
      dataInicial,
      dataFinal,
    }),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch abastecimentos for fuel metrics (no empresaCodigo filter - break down in useMemo)
  const { data: abastecimentosData } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchAbastecimentos({
        dataInicial,
        dataFinal,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20
    ),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  // LMC (entrada de combustível) — custo por litro por produto. Lookback de 3
  // meses pra pegar a última compra. Sem isso a margem dos postos sai ZERADA: o
  // abastecimento live não traz precoCusto (só o cache traz). Mesma fonte de
  // custo que a apuração usa (buildCostMapFromLmc).
  const { data: lmcData } = useQuery({
    queryKey: ['network-lmc', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchLmc({
        empresaCodigo: empresaCodigos,
        dataInicial: offsetPeriod(dataInicial, 3),
        dataFinal,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50,
    ),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  // Catálogo de produtos — alias-expande o custo do LMC (produtoCodigo /
  // produtoLmcCodigo / codigo) pra casar com o código do abastecimento.
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  /* ── Computed data ─────────────────────────────────────── */

  const computed = useMemo(() => {
    const empresaMap = new Map<number, Empresa>()
    for (const e of empresasData ?? []) {
      empresaMap.set(e.empresaCodigo, e)
    }

    // Aggregate resumo by empresa
    const receitaByEmpresa = new Map<number, number>()
    for (const r of resumoData ?? []) {
      receitaByEmpresa.set(r.codigoEmpresa, (receitaByEmpresa.get(r.codigoEmpresa) ?? 0) + r.total)
    }

    // Custo por litro via LMC (entrada), alias-expandido — chave `${emp}-${prod}`.
    const costMap = buildCostMapFromLmc(lmcData ?? [], produtosData ?? [])

    // Aggregate abastecimentos by empresa
    const litrosByEmpresa = new Map<number, number>()
    const abastByEmpresa = new Map<number, number>()
    const fatCombByEmpresa = new Map<number, number>()
    const custoByEmpresa = new Map<number, number>()
    const litrosComCustoByEmpresa = new Map<number, number>()
    for (const a of abastecimentosData ?? []) {
      litrosByEmpresa.set(a.empresaCodigo, (litrosByEmpresa.get(a.empresaCodigo) ?? 0) + a.quantidade)
      abastByEmpresa.set(a.empresaCodigo, (abastByEmpresa.get(a.empresaCodigo) ?? 0) + 1)
      fatCombByEmpresa.set(a.empresaCodigo, (fatCombByEmpresa.get(a.empresaCodigo) ?? 0) + a.valorTotal)
      // Custo: LMC (custoMap) primeiro; cai pro precoCusto do cache se presente.
      const custoUnit = costMap.get(`${a.empresaCodigo}-${a.codigoProduto}`)
        ?? (a.precoCusto != null && a.precoCusto > 0 ? a.precoCusto : 0)
      if (custoUnit > 0) {
        custoByEmpresa.set(a.empresaCodigo, (custoByEmpresa.get(a.empresaCodigo) ?? 0) + custoUnit * a.quantidade)
        litrosComCustoByEmpresa.set(a.empresaCodigo, (litrosComCustoByEmpresa.get(a.empresaCodigo) ?? 0) + a.quantidade)
      }
    }

    // Aggregate vendas (notas) by empresa for conversion calculation
    const vendasByEmpresa = new Map<number, number>()
    for (const r of resumoData ?? []) {
      vendasByEmpresa.set(r.codigoEmpresa, (vendasByEmpresa.get(r.codigoEmpresa) ?? 0) + r.quantidade)
    }

    // Build per-posto data
    const postos: PostoData[] = []
    for (const codigo of empresaCodigos) {
      const empresa = empresaMap.get(codigo)
      if (!empresa) continue

      const receita = receitaByEmpresa.get(codigo) ?? 0
      const litros = litrosByEmpresa.get(codigo) ?? 0
      const abastecimentos = abastByEmpresa.get(codigo) ?? 0
      const totalVendas = vendasByEmpresa.get(codigo) ?? 0
      const produtosVendidos = Math.max(0, totalVendas - abastecimentos)
      const ticketMedio = abastecimentos > 0 ? receita / abastecimentos : 0
      const conversao = abastecimentos > 0 ? (produtosVendidos / abastecimentos) * 100 : 0

      const fatCombustivel = fatCombByEmpresa.get(codigo) ?? 0
      const litrosComCusto = litrosComCustoByEmpresa.get(codigo) ?? 0
      const custoTotal = custoByEmpresa.get(codigo) ?? 0
      const precoLitro = litros > 0 ? fatCombustivel / litros : 0
      const custoLitro = litrosComCusto > 0 ? custoTotal / litrosComCusto : 0
      const lbLitro = custoLitro > 0 ? precoLitro - custoLitro : 0
      const margem = precoLitro > 0 && custoLitro > 0 ? (lbLitro / precoLitro) * 100 : 0
      const comCustoPct = litros > 0 ? (litrosComCusto / litros) * 100 : 0

      postos.push({
        empresaCodigo: codigo,
        nome: empresa.razao,
        fantasia: empresa.fantasia || empresa.razao,
        cidade: empresa.cidade,
        estado: empresa.estado,
        latitude: empresa.latitude,
        longitude: empresa.longitude,
        receita,
        litros,
        abastecimentos,
        ticketMedio,
        conversao,
        produtosVendidos,
        score: 0,
        performance: 'average',
        fatCombustivel,
        precoLitro,
        custoLitro,
        lbLitro,
        margem,
        comCustoPct,
      })
    }

    // Calculate scores
    if (postos.length > 0) {
      const maxReceita = Math.max(...postos.map(p => p.receita), 1)
      const maxConversao = Math.max(...postos.map(p => p.conversao), 1)
      const maxTicket = Math.max(...postos.map(p => p.ticketMedio), 1)
      const maxAbast = Math.max(...postos.map(p => p.abastecimentos), 1)

      const avgScore = { sum: 0, count: 0 }

      for (const p of postos) {
        const scoreReceita = (p.receita / maxReceita) * 30
        const scoreConversao = (p.conversao / maxConversao) * 25
        const scoreTicket = (p.ticketMedio / maxTicket) * 25
        const scoreAbast = (p.abastecimentos / maxAbast) * 20
        p.score = Math.round(scoreReceita + scoreConversao + scoreTicket + scoreAbast)
        avgScore.sum += p.score
        avgScore.count++
      }

      const avg = avgScore.count > 0 ? avgScore.sum / avgScore.count : 50
      for (const p of postos) {
        if (p.score > avg * 1.1) p.performance = 'above'
        else if (p.score < avg * 0.9) p.performance = 'below'
        else p.performance = 'average'
      }
    }

    // Sort by score descending
    postos.sort((a, b) => b.score - a.score)

    // Network averages
    const totLitrosRede = postos.reduce((s, p) => s + p.litros, 0)
    const totFatCombRede = postos.reduce((s, p) => s + p.fatCombustivel, 0)
    const networkAvg = {
      receita: postos.length > 0 ? postos.reduce((s, p) => s + p.receita, 0) / postos.length : 0,
      litros: postos.length > 0 ? totLitrosRede / postos.length : 0,
      abastecimentos: postos.length > 0 ? postos.reduce((s, p) => s + p.abastecimentos, 0) / postos.length : 0,
      ticketMedio: postos.length > 0 ? postos.reduce((s, p) => s + p.ticketMedio, 0) / postos.length : 0,
      conversao: postos.length > 0 ? postos.reduce((s, p) => s + p.conversao, 0) / postos.length : 0,
      // Preço médio/litro da rede — ponderado pelo volume (não média simples).
      precoLitro: totLitrosRede > 0 ? totFatCombRede / totLitrosRede : 0,
    }

    // Network totals
    const networkTotals = {
      receita: postos.reduce((s, p) => s + p.receita, 0),
      litros: postos.reduce((s, p) => s + p.litros, 0),
      abastecimentos: postos.reduce((s, p) => s + p.abastecimentos, 0),
      ticketMedio: networkAvg.ticketMedio,
      conversao: networkAvg.conversao,
    }

    // Generate insights
    const insights: NetworkInsight[] = []
    for (const p of postos) {
      if (networkAvg.conversao > 0) {
        const diff = ((p.conversao - networkAvg.conversao) / networkAvg.conversao) * 100
        if (diff > 20) {
          insights.push({
            type: 'positive',
            posto: p.fantasia,
            message: `possui conversão ${Math.round(diff)}% acima da média da rede.`,
          })
        } else if (diff < -20) {
          insights.push({
            type: 'warning',
            posto: p.fantasia,
            message: `possui conversão ${Math.round(Math.abs(diff))}% abaixo da média da rede.`,
          })
        }
      }
      if (networkAvg.receita > 0) {
        const diff = ((p.receita - networkAvg.receita) / networkAvg.receita) * 100
        if (diff > 30) {
          insights.push({
            type: 'positive',
            posto: p.fantasia,
            message: `lidera em faturamento com ${Math.round(diff)}% acima da média.`,
          })
        } else if (diff < -30) {
          insights.push({
            type: 'warning',
            posto: p.fantasia,
            message: `apresenta faturamento ${Math.round(Math.abs(diff))}% abaixo da média da rede.`,
          })
        }
      }
      if (networkAvg.ticketMedio > 0) {
        const diff = ((p.ticketMedio - networkAvg.ticketMedio) / networkAvg.ticketMedio) * 100
        if (diff > 25) {
          insights.push({
            type: 'info',
            posto: p.fantasia,
            message: `tem ticket médio ${Math.round(diff)}% superior à média.`,
          })
        }
      }
    }

    // Generate goals (target = 110% of network average)
    const goals: PostoGoal[] = postos.map((p) => ({
      empresaCodigo: p.empresaCodigo,
      nome: p.fantasia,
      goals: [
        {
          label: 'Litros Vendidos',
          current: p.litros,
          target: networkAvg.litros * 1.1,
          percent: networkAvg.litros > 0 ? Math.min(Math.round((p.litros / (networkAvg.litros * 1.1)) * 100), 100) : 0,
          unit: 'L',
        },
        {
          label: 'Faturamento',
          current: p.receita,
          target: networkAvg.receita * 1.1,
          percent: networkAvg.receita > 0 ? Math.min(Math.round((p.receita / (networkAvg.receita * 1.1)) * 100), 100) : 0,
          unit: 'R$',
        },
        {
          label: 'Conversão de Produtos',
          current: p.conversao,
          target: networkAvg.conversao * 1.1,
          percent: networkAvg.conversao > 0 ? Math.min(Math.round((p.conversao / (networkAvg.conversao * 1.1)) * 100), 100) : 0,
          unit: '%',
        },
        {
          label: 'Ticket Médio',
          current: p.ticketMedio,
          target: networkAvg.ticketMedio * 1.1,
          percent: networkAvg.ticketMedio > 0 ? Math.min(Math.round((p.ticketMedio / (networkAvg.ticketMedio * 1.1)) * 100), 100) : 0,
          unit: 'R$',
        },
      ],
    }))

    // Generate sales forecast (simple linear projection)
    const dailySalesMap = new Map<string, number>()
    for (const r of resumoData ?? []) {
      const day = r.data?.slice(0, 10)
      if (day) {
        dailySalesMap.set(day, (dailySalesMap.get(day) ?? 0) + r.total)
      }
    }

    const sortedDays = [...dailySalesMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    const forecastData: ForecastPoint[] = []
    if (sortedDays.length >= 2) {
      // Build real data points
      for (const [date, value] of sortedDays) {
        forecastData.push({ date, real: value, trend: null, forecast: null })
      }

      // Simple linear regression
      const n = sortedDays.length
      const xMean = (n - 1) / 2
      const yMean = sortedDays.reduce((s, [, v]) => s + v, 0) / n
      let num = 0, den = 0
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (sortedDays[i][1] - yMean)
        den += (i - xMean) ** 2
      }
      const slope = den !== 0 ? num / den : 0
      const intercept = yMean - slope * xMean

      // Add trend line
      for (let i = 0; i < forecastData.length; i++) {
        forecastData[i].trend = Math.max(0, Math.round(intercept + slope * i))
      }

      // Project 7 days into the future
      const lastDate = new Date(sortedDays[sortedDays.length - 1][0])
      for (let d = 1; d <= 7; d++) {
        const nextDate = new Date(lastDate)
        nextDate.setDate(nextDate.getDate() + d)
        const dateStr = nextDate.toISOString().slice(0, 10)
        forecastData.push({
          date: dateStr,
          real: 0,
          trend: Math.max(0, Math.round(intercept + slope * (n - 1 + d))),
          forecast: Math.max(0, Math.round(intercept + slope * (n - 1 + d))),
        })
      }
    }

    // Generate alerts for control center
    const alerts: NetworkAlert[] = []
    for (const p of postos) {
      if (p.performance === 'below') {
        alerts.push({
          type: 'danger',
          posto: p.fantasia,
          message: `Desempenho abaixo da média (Score: ${p.score})`,
        })
      }
      if (networkAvg.conversao > 0 && p.conversao < networkAvg.conversao * 0.7) {
        alerts.push({
          type: 'warning',
          posto: p.fantasia,
          message: `Baixa conversão de produtos (${p.conversao.toFixed(0)}%)`,
        })
      }
      if (networkAvg.receita > 0 && p.receita < networkAvg.receita * 0.6) {
        alerts.push({
          type: 'danger',
          posto: p.fantasia,
          message: `Faturamento muito abaixo da média da rede`,
        })
      }
    }

    return {
      postos,
      networkAvg,
      networkTotals,
      insights,
      goals,
      forecastData,
      alerts,
      empresaMap,
    }
  }, [empresaCodigos, empresasData, resumoData, abastecimentosData, lmcData, produtosData])

  const isLoading = !resumoData || !abastecimentosData

  return {
    ...computed,
    isLoading,
    hasEmpresa,
  }
}

export default useNetworkData
