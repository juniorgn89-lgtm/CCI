import { useEffect, useMemo, useRef } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchLmc } from '@/api/endpoints/combustiveis'
import useFuelVendaCost from '@/pages/Operacao/hooks/useFuelVendaCost'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useTenantStore } from '@/store/tenant'
import useApuracaoCache from './useApuracaoCache'
import { computeApuracaoRows, upsertApuracaoDiaria } from '@/api/supabase/apuracao'
import { offsetPeriod } from '@/lib/period'

export type Setor = 'combustivel' | 'automotivos' | 'conveniencia'

export interface SectorKpi {
  label: string
  lucroBruto: number
  faturamento: number
  margem: number
  lbPorLitro?: number
  prevYearLucroBruto?: number
}

export interface ProjectionRow {
  setor: string
  faturamento: number
  lucroBruto: number
  margem: number
}

export interface ProductDetail {
  produtoCodigo: number
  nome: string
  litros: number
  lucroBruto: number
  margem: number
  precoVenda: number
  precoCusto: number
  lbPorLitro: number
}

export interface EmpresaDetail {
  empresaCodigo: number
  empresa: string
  litros: number
  lucroBruto: number
  margem: number
  precoVenda: number
  precoCusto: number
  lbPorLitro: number
  produtos: ProductDetail[]
  // Non-fuel fields
  quantidade?: number
  faturamento?: number
  precoMedio?: number
  custoMedio?: number
  ticketMedio?: number
}

export interface TotalRow {
  litros: number
  lucroBruto: number
  margem: number
  precoVenda: number
  precoCusto: number
  lbPorLitro: number
  // Non-fuel fields
  quantidade?: number
  faturamento?: number
  precoMedio?: number
  custoMedio?: number
  ticketMedio?: number
}

export interface PeriodComparison {
  prevMonth: { faturamento: number; lucroBruto: number; abastecimentos: number }
  prevYear: { faturamento: number; lucroBruto: number }
}

export interface QuickStats {
  litrosVendidos: number
  totalAbastecimentos: number
  receitaDia: number
  ticketMedio: number
  produtosVendidos: number
  margemMedia: number
}

export interface SalesEvolutionPoint {
  date: string
  fuelRevenue: number
  nonFuelRevenue: number
}

export interface FrentistaRankingItem {
  codigoFrentista: number
  nome: string
  litros: number
  receita: number
  atendimentos: number
}

// Get date 3 months before a given date string (yyyy-MM-dd)
const threeMonthsBefore = (dateStr: string): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - 3)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}


interface UseDashboardDataOptions {
  /** Override de período — quando fornecido, ignora dataInicial/dataFinal do filter store */
  period?: { dataInicial: string; dataFinal: string }
}

const useDashboardData = (options: UseDashboardDataOptions = {}) => {
  const filter = useFilterStore()
  const empresaCodigos = filter.empresaCodigos
  const dataInicial = options.period?.dataInicial ?? filter.dataInicial
  const dataFinal = options.period?.dataFinal ?? filter.dataFinal

  const hasEmpresa = empresaCodigos.length > 0
  // Custo médio (CMV) + desconto de combustível por produto, via /VENDA_ITEM
  // (mesma fonte do BI). Substitui o custo do LMC no lucro/margem de combustível.
  const { vendaByProduct: fuelVenda } = useFuelVendaCost(empresaCodigos, dataInicial, dataFinal)
  const rede = useTenantStore((s) => s.rede)

  // LMC lookback: fetch from 3 months before to capture most recent cost data
  const lmcDataInicial = threeMonthsBefore(dataInicial)

  // Comparison periods
  const prevMonthInicial = offsetPeriod(dataInicial, 1)
  const prevMonthFinal = offsetPeriod(dataFinal, 1)
  const prevYearInicial = offsetPeriod(dataInicial, 12)
  const prevYearFinal = offsetPeriod(dataFinal, 12)

  // Empresas declaradas antes do cache check pra fornecer a lista permitida
  // ao useApuracaoCache (que precisa saber as empresas pra estimar cobertura).
  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  // Filtra pela restrição do user logado (profiles.empresa_codigos).
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const empresasPermitidasCodes = useMemo(() => empresas.map((e) => e.codigo), [empresas])
  const allowedCodes = useMemo(() => new Set(empresasPermitidasCodes), [empresasPermitidasCodes])

  // Tenta servir do cache em Supabase. v2: cobre dias fechados (mês passado
  // completo OU dias fechados do mês corrente). Hoje continua sempre live.
  const cache = useApuracaoCache({
    empresasPermitidas: empresasPermitidasCodes,
    empresaCodigosFiltro: empresaCodigos,
    dataInicial,
    dataFinal,
  })

  // v2.5: cache também pros períodos comparativos (prev month/year). Esses são
  // sempre passados, então quase sempre cacheáveis. Sem isso, os fetches de
  // prev abast/resumo eram o gargalo mesmo com cache HIT no main.
  const cachePrevMonth = useApuracaoCache({
    empresasPermitidas: empresasPermitidasCodes,
    empresaCodigosFiltro: empresaCodigos,
    dataInicial: prevMonthInicial,
    dataFinal: prevMonthFinal,
  })
  const cachePrevYear = useApuracaoCache({
    empresasPermitidas: empresasPermitidasCodes,
    empresaCodigosFiltro: empresaCodigos,
    dataInicial: prevYearInicial,
    dataFinal: prevYearFinal,
  })

  // Range efetivo do fetch da API Quality pro período corrente:
  //  - cache HIT  + tem hoje → só hoje (1 dia, rápido)
  //  - cache HIT  + sem hoje → não fetcha nada (todos os dias estão no cache)
  //  - cache MISS / inelegível → período completo (comportamento v1)
  const effectiveRange: { dataInicial: string; dataFinal: string } | null = cache.isCacheHit
    ? cache.split.todayPart
    : { dataInicial, dataFinal }
  const effIni = effectiveRange?.dataInicial ?? ''
  const effEnd = effectiveRange?.dataFinal ?? ''
  const shouldFetchMain = !!effectiveRange && !cache.isChecking

  // VENDA_RESUMO for global faturamento per empresa
  const { data: resumoAtual = [], isLoading: isLoadingResumo } = useQuery({
    queryKey: ['vendaResumo', empresaCodigos, effIni, effEnd],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
        dataInicial: effIni,
        dataFinal: effEnd,
      }),
    enabled: shouldFetchMain,
    placeholderData: keepPreviousData,
  })

  // VENDA_RESUMO for previous month — pulado quando cache HIT do prev month
  const { data: resumoPrevMonth = [] } = useQuery({
    queryKey: ['vendaResumoPrevMonth', empresaCodigos, prevMonthInicial, prevMonthFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
        dataInicial: prevMonthInicial,
        dataFinal: prevMonthFinal,
      }),
    enabled: !cachePrevMonth.isCacheHit && !cachePrevMonth.isChecking,
    retry: false,
  })

  // VENDA_RESUMO for same period last year — pulado quando cache HIT
  const { data: resumoPrevYear = [] } = useQuery({
    queryKey: ['vendaResumoPrevYear', empresaCodigos, prevYearInicial, prevYearFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
        dataInicial: prevYearInicial,
        dataFinal: prevYearFinal,
      }),
    enabled: !cachePrevYear.isCacheHit && !cachePrevYear.isChecking,
    retry: false,
  })

  // ABASTECIMENTO — chunked by week to avoid 50k API limit.
  // Esta é a query mais cara (até 50k+ records). Em cache HIT no mês corrente
  // o range cai pra só hoje (1 dia, ~600ms). Em mês fechado completo, skipa
  // totalmente (effectiveRange=null).
  const { data: abastecimentos = [], isLoading: isLoadingAbast } = useQuery({
    queryKey: ['abastecimentos', effIni, effEnd],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: effIni, dataFinal: effEnd }),
    enabled: shouldFetchMain,
    placeholderData: keepPreviousData,
  })

  const { data: abastPrevMonth = [] } = useQuery({
    queryKey: ['abastecimentos', prevMonthInicial, prevMonthFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prevMonthInicial, dataFinal: prevMonthFinal }),
    enabled: !cachePrevMonth.isCacheHit && !cachePrevMonth.isChecking,
    retry: false,
  })

  const { data: abastPrevYear = [] } = useQuery({
    queryKey: ['abastecimentos', prevYearInicial, prevYearFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prevYearInicial, dataFinal: prevYearFinal }),
    enabled: !cachePrevYear.isCacheHit && !cachePrevYear.isChecking,
    retry: false,
  })

  // Quando não há empresa selecionada (Central da Rede), passamos explicitamente todos os códigos
  // pra LMC — a API exige empresaCodigo pra retornar custos, e isso evita colisão de cache com
  // outras páginas que já populam ['lmc', ...] filtrando por uma única empresa.
  const allEmpresaCodes = (empresasData?.resultados ?? []).map((e) => e.codigo)
  const lmcEmpresaCodigos = hasEmpresa ? empresaCodigos : allEmpresaCodes
  const lmcEmpresaKey = lmcEmpresaCodigos.slice().sort((a, b) => a - b).join(',')

  // LMC só é necessária quando há cálculo de custo ao vivo (algum período
  // sem cache). Se main + prevMonth + prevYear estão TODOS em cache HIT,
  // o custo já vem agregado em fuel_custo — LMC vira esforço perdido.
  const allCachesHit =
    cache.isCacheHit && cachePrevMonth.isCacheHit && cachePrevYear.isCacheHit
  const { data: lmcData = [], isLoading: isLoadingLmc } = useQuery({
    queryKey: ['lmc', lmcDataInicial, dataFinal, lmcEmpresaKey],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchLmc({
          empresaCodigo: lmcEmpresaCodigos,
          dataInicial: lmcDataInicial, dataFinal,
          ultimoCodigo: p.ultimoCodigo, limite: p.limite,
        }),
        1000, 50
      ),
    enabled: lmcEmpresaCodigos.length > 0 && !allCachesHit,
    placeholderData: keepPreviousData,
  })

  // Products (cached)
  const { data: produtosData, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 100
      ),
    staleTime: 30 * 60 * 1000,
  })

  // Funcionarios (cached) for frentista names
  const { data: funcionariosData } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => fetchAllPages(
      (p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 10
    ),
    staleTime: 30 * 60 * 1000,
  })

  // `empresas`/`empresasPermitidasCodes`/`allowedCodes` já foram declaradas no
  // topo (precisaram vir antes do useApuracaoCache).
  const isLoading = isLoadingResumo || isLoadingAbast || isLoadingLmc || isLoadingProdutos || isLoadingEmpresas

  // Helper: check if an empresa code matches the current filter + restrição.
  // Quando o user é restrito, códigos fora da whitelist NUNCA passam — mesmo
  // se o filtro global estiver vazio (Central da Rede). Empresa só é "visível"
  // se está dentro das permitidas E (filtro vazio OU filtro a contém).
  const matchesEmpresa = (code: number): boolean => {
    if (allowedCodes.size > 0 && !allowedCodes.has(code)) return false
    if (empresaCodigos.length === 0) return true
    return empresaCodigos.includes(code)
  }

  const computed = useMemo(() => {
    // Empresa name map
    const empresaMap = new Map<number, string>()
    for (const e of empresas) {
      empresaMap.set(e.codigo, e.fantasia)
    }

    // Product name map
    const productMap = new Map<number, string>()
    for (const p of produtosData ?? []) {
      productMap.set(p.produtoCodigo, p.nome)
    }

    // Build cost map from LMC: empresa+produtoCodigo -> most recent precoCusto
    // Use the latest LMC entry per empresa+product (sort by dataMovimento desc)
    const costMap = new Map<string, number>()
    const sortedLmc = [...lmcData].sort(
      (a, b) => b.dataMovimento.localeCompare(a.dataMovimento)
    )
    for (const lmc of sortedLmc) {
      for (const prodCode of lmc.produtoCodigo) {
        const key = `${lmc.empresaCodigo}-${prodCode}`
        // Only keep most recent (first encountered after desc sort)
        if (!costMap.has(key) && lmc.precoCusto > 0) {
          costMap.set(key, lmc.precoCusto)
        }
      }
    }
    const getCost = (empresaCod: number, produtoCod: number): number => {
      return costMap.get(`${empresaCod}-${produtoCod}`) ?? 0
    }
    // Custo médio (CMV) por litro do item de venda; cai no LMC se não casar.
    const fuelCostUnit = (empresaCod: number, produtoCod: number): number => {
      const v = fuelVenda.get(produtoCod)
      return v && v.custoUnit > 0 ? v.custoUnit : getCost(empresaCod, produtoCod)
    }
    // Fator pra converter faturamento BRUTO em LÍQUIDO (1 − taxa de desconto).
    const fuelNetRate = (produtoCod: number): number => 1 - (fuelVenda.get(produtoCod)?.descRate ?? 0)

    // ─── Agregados dos períodos comparativos (prev month / prev year) ───
    // v2.5: usa cache do Supabase quando disponível, fallback pra abast+lmc
    // live caso contrário. Evita o gargalo de baixar 1-2 meses de raw data
    // toda vez que o user troca de período pra outro já cacheado.
    interface PrevAgg { fuelFat: number; fuelLB: number; vendasTotal: number }
    const aggregateFromCache = (rows: typeof cache.rows): PrevAgg => {
      let fuelFat = 0, fuelLB = 0, vendasTotal = 0
      for (const r of rows) {
        if (!matchesEmpresa(r.empresa_codigo)) continue
        fuelFat += r.fuel_faturamento
        fuelLB += r.fuel_lucro_bruto
        vendasTotal += r.vendas_total
      }
      return { fuelFat, fuelLB, vendasTotal }
    }
    const aggregateFromLive = (
      abastData: typeof abastPrevMonth,
      resumoData: typeof resumoPrevMonth
    ): PrevAgg => {
      let fuelFat = 0, fuelCusto = 0, vendasTotal = 0
      for (const a of abastData) {
        if (!matchesEmpresa(a.empresaCodigo)) continue
        fuelFat += a.valorTotal
        fuelCusto += getCost(a.empresaCodigo, Number(a.codigoProduto)) * a.quantidade
      }
      for (const r of resumoData) {
        if (!matchesEmpresa(r.codigoEmpresa)) continue
        vendasTotal += r.total
      }
      return { fuelFat, fuelLB: fuelFat - fuelCusto, vendasTotal }
    }
    const prevMonthAgg: PrevAgg = cachePrevMonth.isCacheHit
      ? aggregateFromCache(cachePrevMonth.rows)
      : aggregateFromLive(abastPrevMonth, resumoPrevMonth)
    const prevYearAgg: PrevAgg = cachePrevYear.isCacheHit
      ? aggregateFromCache(cachePrevYear.rows)
      : aggregateFromLive(abastPrevYear, resumoPrevYear)

    // ═══════════════════════════════════════════════════════════════════════
    // CACHE HIT branch — combina cache (dias fechados) com apuração de hoje
    // (computada das fetches live do dia). Comparações YoY/MoM seguem live.
    // ═══════════════════════════════════════════════════════════════════════
    if (cache.isCacheHit) {
      // Apuração de hoje (se aplicável) — calculada da fetch live narrowed
      // ao range [hoje..hoje]. Se o período é totalmente fechado (mês passado),
      // todayPart é null e nenhuma row extra é gerada.
      const todayRows = cache.split.todayPart && rede?.id
        ? computeApuracaoRows({
            redeId: rede.id,
            empresaCodigos: empresasPermitidasCodes,
            dataInicial: cache.split.todayPart.dataInicial,
            dataFinal: cache.split.todayPart.dataFinal,
            abastecimentos,
            lmc: lmcData,
            vendaResumo: resumoAtual,
            produtos: produtosData,
          })
        : []
      const unifiedRows = [...cache.rows, ...todayRows]
      const visibleRows = unifiedRows.filter((r) => matchesEmpresa(r.empresa_codigo))
      interface CacheFuelAgg { litros: number; fat: number; custo: number; lb: number; count: number }
      const fuelByEmp = new Map<number, CacheFuelAgg>()
      const vendasByEmp = new Map<number, { total: number; qtd: number }>()
      let tFuelLitros = 0, tFuelFat = 0, tFuelCusto = 0, tFuelCount = 0
      let tVendas = 0, tVendasQtd = 0

      for (const r of visibleRows) {
        const f = fuelByEmp.get(r.empresa_codigo) ?? { litros: 0, fat: 0, custo: 0, lb: 0, count: 0 }
        fuelByEmp.set(r.empresa_codigo, {
          litros: f.litros + r.fuel_litros,
          fat: f.fat + r.fuel_faturamento,
          custo: f.custo + r.fuel_custo,
          lb: f.lb + r.fuel_lucro_bruto,
          count: f.count + r.fuel_abast_count,
        })
        const v = vendasByEmp.get(r.empresa_codigo) ?? { total: 0, qtd: 0 }
        vendasByEmp.set(r.empresa_codigo, {
          total: v.total + r.vendas_total,
          qtd: v.qtd + r.vendas_qtd,
        })
        tFuelLitros += r.fuel_litros
        tFuelFat += r.fuel_faturamento
        tFuelCusto += r.fuel_custo
        tFuelCount += r.fuel_abast_count
        tVendas += r.vendas_total
        tVendasQtd += r.vendas_qtd
      }

      const tFuelLB = tFuelFat - tFuelCusto
      const fuelMargem = tFuelFat > 0 ? (tFuelLB / tFuelFat) * 100 : 0
      const faturamentoGlobal = tVendas
      const nonFuelFat = Math.max(0, faturamentoGlobal - tFuelFat)
      const automotivosFat = nonFuelFat * 0.30
      const convenienciaFat = nonFuelFat * 0.70
      const autoMarginRate = 0.66
      const convMarginRate = 0.50

      const sectorKpis: SectorKpi[] = [
        { label: 'Combustível', lucroBruto: tFuelLB, faturamento: tFuelFat, margem: fuelMargem, lbPorLitro: tFuelLitros > 0 ? tFuelLB / tFuelLitros : 0 },
        { label: 'Automotivos', lucroBruto: automotivosFat * autoMarginRate, faturamento: automotivosFat, margem: autoMarginRate * 100 },
        { label: 'Conveniência', lucroBruto: convenienciaFat * convMarginRate, faturamento: convenienciaFat, margem: convMarginRate * 100 },
      ]

      // Prev year — usa prevYearAgg (cache ou live, definido acima).
      const prevYearGlobalFat = prevYearAgg.vendasTotal
      const prevYearFuelFat = prevYearAgg.fuelFat
      const prevYearFuelLB = prevYearAgg.fuelLB
      const prevYearNonFuelFat = Math.max(0, prevYearGlobalFat - prevYearFuelFat)
      if (prevYearGlobalFat > 0) {
        sectorKpis[0].prevYearLucroBruto = prevYearFuelLB
        sectorKpis[1].prevYearLucroBruto = prevYearNonFuelFat * 0.30 * autoMarginRate
        sectorKpis[2].prevYearLucroBruto = prevYearNonFuelFat * 0.70 * convMarginRate
      }

      const globalLucroBruto = sectorKpis.reduce((s, k) => s + k.lucroBruto, 0)
      const globalMargem = faturamentoGlobal > 0 ? (globalLucroBruto / faturamentoGlobal) * 100 : 0
      const prevYearGlobalLB = sectorKpis.reduce((s, k) => s + (k.prevYearLucroBruto ?? 0), 0)

      const globalKpi: SectorKpi = {
        label: 'Global',
        lucroBruto: globalLucroBruto,
        faturamento: faturamentoGlobal,
        margem: globalMargem,
        prevYearLucroBruto: prevYearGlobalFat > 0 ? prevYearGlobalLB : undefined,
      }

      const projectionData: ProjectionRow[] = [
        ...sectorKpis.map((k) => ({ setor: k.label, faturamento: k.faturamento, lucroBruto: k.lucroBruto, margem: k.margem })),
        { setor: 'Total', faturamento: faturamentoGlobal, lucroBruto: globalLucroBruto, margem: globalMargem },
      ]

      // sectorDetails.combustivel.empresas (sem produtos detalhados — cache não tem)
      const fuelEmpresas: EmpresaDetail[] = []
      for (const [empCodigo, agg] of fuelByEmp.entries()) {
        if (agg.litros <= 0) continue
        fuelEmpresas.push({
          empresaCodigo: empCodigo,
          empresa: empresaMap.get(empCodigo) ?? `Empresa ${empCodigo}`,
          litros: agg.litros,
          lucroBruto: agg.lb,
          margem: agg.fat > 0 ? (agg.lb / agg.fat) * 100 : 0,
          precoVenda: agg.litros > 0 ? agg.fat / agg.litros : 0,
          precoCusto: agg.litros > 0 ? agg.custo / agg.litros : 0,
          lbPorLitro: agg.litros > 0 ? agg.lb / agg.litros : 0,
          produtos: [],
        })
      }
      fuelEmpresas.sort((a, b) => b.lucroBruto - a.lucroBruto)

      const fuelTotal: TotalRow = {
        litros: tFuelLitros,
        lucroBruto: tFuelLB,
        margem: fuelMargem,
        precoVenda: tFuelLitros > 0 ? tFuelFat / tFuelLitros : 0,
        precoCusto: tFuelLitros > 0 ? tFuelCusto / tFuelLitros : 0,
        lbPorLitro: tFuelLitros > 0 ? tFuelLB / tFuelLitros : 0,
      }

      const buildNonFuelFromCache = (splitRatio: number, marginRate: number) => {
        const nonFuelEmpresas: EmpresaDetail[] = []
        let totQtd = 0, totFat = 0, totLB = 0
        for (const [empCodigo, vendas] of vendasByEmp.entries()) {
          const fuel = fuelByEmp.get(empCodigo)
          const fuelFat = fuel?.fat ?? 0
          const empNonFuelFat = Math.max(0, vendas.total - fuelFat) * splitRatio
          const empNonFuelQtd = vendas.qtd * splitRatio
          if (empNonFuelFat <= 0) continue
          const lb = empNonFuelFat * marginRate
          const tm = empNonFuelQtd > 0 ? empNonFuelFat / empNonFuelQtd : 0
          const cm = empNonFuelQtd > 0 ? (empNonFuelFat - lb) / empNonFuelQtd : 0
          nonFuelEmpresas.push({
            empresaCodigo: empCodigo,
            empresa: empresaMap.get(empCodigo) ?? `Empresa ${empCodigo}`,
            litros: 0, lucroBruto: lb, margem: marginRate * 100,
            precoVenda: 0, precoCusto: 0, lbPorLitro: 0, produtos: [],
            quantidade: Math.round(empNonFuelQtd),
            faturamento: empNonFuelFat,
            precoMedio: tm, custoMedio: cm, ticketMedio: tm,
          })
          totQtd += empNonFuelQtd; totFat += empNonFuelFat; totLB += lb
        }
        nonFuelEmpresas.sort((a, b) => (b.faturamento ?? 0) - (a.faturamento ?? 0))
        return {
          empresas: nonFuelEmpresas,
          total: {
            litros: 0, lucroBruto: totLB, margem: totFat > 0 ? (totLB / totFat) * 100 : 0,
            precoVenda: 0, precoCusto: 0, lbPorLitro: 0,
            quantidade: Math.round(totQtd), faturamento: totFat,
            precoMedio: totQtd > 0 ? totFat / totQtd : 0,
            custoMedio: totQtd > 0 ? (totFat - totLB) / totQtd : 0,
            ticketMedio: totQtd > 0 ? totFat / totQtd : 0,
          },
        }
      }

      const sectorDetails: Record<Setor, { empresas: EmpresaDetail[]; total: TotalRow }> = {
        combustivel: { empresas: fuelEmpresas, total: fuelTotal },
        automotivos: buildNonFuelFromCache(0.30, autoMarginRate),
        conveniencia: buildNonFuelFromCache(0.70, convMarginRate),
      }

      // Comparison — usa prevMonthAgg/prevYearAgg (cache ou live).
      const nonFuelMargin = autoMarginRate * 0.30 + convMarginRate * 0.70
      const cmpPrevMonthNonFuelFat = Math.max(0, prevMonthAgg.vendasTotal - prevMonthAgg.fuelFat)
      const cmpPrevYearNonFuelFat = Math.max(0, prevYearAgg.vendasTotal - prevYearAgg.fuelFat)
      // Quando prev month vem do cache, o count vem do fuel_abast_count somado;
      // caso contrário (live), conta records do abastPrevMonth filtrado.
      const prevMonthAbastCount = cachePrevMonth.isCacheHit
        ? cachePrevMonth.rows.reduce((s, r) => matchesEmpresa(r.empresa_codigo) ? s + r.fuel_abast_count : s, 0)
        : abastPrevMonth.filter((a) => matchesEmpresa(a.empresaCodigo)).length
      const comparison: PeriodComparison = {
        prevMonth: {
          faturamento: prevMonthAgg.vendasTotal,
          lucroBruto: prevMonthAgg.fuelLB + cmpPrevMonthNonFuelFat * nonFuelMargin,
          abastecimentos: prevMonthAbastCount,
        },
        prevYear: {
          faturamento: prevYearAgg.vendasTotal,
          lucroBruto: prevYearAgg.fuelLB + cmpPrevYearNonFuelFat * nonFuelMargin,
        },
      }

      const quickStats: QuickStats = {
        litrosVendidos: tFuelLitros,
        totalAbastecimentos: tFuelCount,
        receitaDia: faturamentoGlobal,
        ticketMedio: tFuelCount > 0 ? tFuelFat / tFuelCount : 0,
        produtosVendidos: Math.max(0, tVendasQtd - tFuelCount),
        margemMedia: globalMargem,
      }

      const fuelByDay = new Map<string, number>()
      for (const r of visibleRows) {
        fuelByDay.set(r.data, (fuelByDay.get(r.data) ?? 0) + r.fuel_faturamento)
      }
      const totalFuelDays = Array.from(fuelByDay.values()).reduce((s, v) => s + v, 0)
      const salesEvolution: SalesEvolutionPoint[] = Array.from(fuelByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, fuelRev]) => ({
          date,
          fuelRevenue: fuelRev,
          nonFuelRevenue: totalFuelDays > 0 ? nonFuelFat * (fuelRev / totalFuelDays) : 0,
        }))

      return {
        sectorKpis,
        globalKpi,
        projectionData,
        sectorDetails,
        comparison,
        quickStats,
        salesEvolution,
        frentistaRanking: [] as FrentistaRankingItem[],
      }
    }

    // Global faturamento from VENDA_RESUMO — só de empresas visíveis
    // (matchesEmpresa cobre tanto filtro global quanto restrição de user).
    const faturamentoGlobal = resumoAtual.reduce(
      (acc, r) => (matchesEmpresa(r.codigoEmpresa) ? acc + r.total : acc),
      0
    )

    // Aggregate abastecimentos by empresa -> produto
    type FuelAgg = { quantidade: number; valorTotal: number; precoVendaSum: number; count: number }
    const fuelByEmpProd = new Map<string, FuelAgg>()
    const fuelByEmp = new Map<number, FuelAgg>()

    // Filtra por filtro global + restrição do user. matchesEmpresa cobre os
    // dois casos — não pode ter guard de `hasEmpresa` aqui porque mesmo sem
    // filtro global o user restrito não pode ver outros postos.
    const filteredAbast = abastecimentos.filter((a) => matchesEmpresa(a.empresaCodigo))

    for (const a of filteredAbast) {
      const prodCode = Number(a.codigoProduto)
      if (prodCode <= 0) continue // skip invalid/test records
      const key = `${a.empresaCodigo}-${prodCode}`

      const prev = fuelByEmpProd.get(key) ?? { quantidade: 0, valorTotal: 0, precoVendaSum: 0, count: 0 }
      fuelByEmpProd.set(key, {
        quantidade: prev.quantidade + a.quantidade,
        valorTotal: prev.valorTotal + a.valorTotal,
        precoVendaSum: prev.precoVendaSum + a.valorUnitario,
        count: prev.count + 1,
      })

      const prevEmp = fuelByEmp.get(a.empresaCodigo) ?? { quantidade: 0, valorTotal: 0, precoVendaSum: 0, count: 0 }
      fuelByEmp.set(a.empresaCodigo, {
        quantidade: prevEmp.quantidade + a.quantidade,
        valorTotal: prevEmp.valorTotal + a.valorTotal,
        precoVendaSum: prevEmp.precoVendaSum + a.valorUnitario,
        count: prevEmp.count + 1,
      })
    }

    // Calculate fuel totals
    let fuelLitros = 0
    let fuelFaturamento = 0
    let fuelCusto = 0
    for (const [key, agg] of fuelByEmpProd.entries()) {
      const [empStr, prodStr] = key.split('-')
      const prodCod = Number(prodStr)
      const cost = fuelCostUnit(Number(empStr), prodCod)
      fuelLitros += agg.quantidade
      fuelFaturamento += agg.valorTotal * fuelNetRate(prodCod)
      fuelCusto += cost * agg.quantidade
    }
    const fuelLucroBruto = fuelFaturamento - fuelCusto
    const fuelMargem = fuelFaturamento > 0 ? (fuelLucroBruto / fuelFaturamento) * 100 : 0

    // Non-fuel faturamento = total VENDA_RESUMO - fuel ABASTECIMENTO
    const nonFuelFat = Math.max(0, faturamentoGlobal - fuelFaturamento)
    // Split non-fuel: 30% automotivos, 70% conveniencia (typical gas station ratio)
    const automotivosFat = nonFuelFat * 0.30
    const convenienciaFat = nonFuelFat * 0.70

    // Estimated margins
    const autoMarginRate = 0.66
    const convMarginRate = 0.50

    // Sector KPIs
    const sectorKpis: SectorKpi[] = [
      {
        label: 'Combustível',
        lucroBruto: fuelLucroBruto,
        faturamento: fuelFaturamento,
        margem: fuelMargem,
        lbPorLitro: fuelLitros > 0 ? fuelLucroBruto / fuelLitros : 0,
      },
      {
        label: 'Automotivos',
        lucroBruto: automotivosFat * autoMarginRate,
        faturamento: automotivosFat,
        margem: autoMarginRate * 100,
      },
      {
        label: 'Conveniência',
        lucroBruto: convenienciaFat * convMarginRate,
        faturamento: convenienciaFat,
        margem: convMarginRate * 100,
      },
    ]

    // Previous year — usa prevYearAgg pré-computado (cache ou live).
    const prevYearGlobalFat = prevYearAgg.vendasTotal
    const prevYearFuelFat = prevYearAgg.fuelFat
    const prevYearFuelLB = prevYearAgg.fuelLB
    const prevYearNonFuelFat = Math.max(0, prevYearGlobalFat - prevYearFuelFat)
    const prevYearAutoFat = prevYearNonFuelFat * 0.30
    const prevYearConvFat = prevYearNonFuelFat * 0.70

    // Distribute prevYear lucro bruto per sector using actual data
    if (prevYearGlobalFat > 0) {
      sectorKpis[0].prevYearLucroBruto = prevYearFuelLB
      sectorKpis[1].prevYearLucroBruto = prevYearAutoFat * autoMarginRate
      sectorKpis[2].prevYearLucroBruto = prevYearConvFat * convMarginRate
    }

    const globalLucroBruto = sectorKpis.reduce((s, k) => s + k.lucroBruto, 0)
    const globalMargem = faturamentoGlobal > 0 ? (globalLucroBruto / faturamentoGlobal) * 100 : 0

    const prevYearGlobalLB = sectorKpis.reduce((s, k) => s + (k.prevYearLucroBruto ?? 0), 0)

    const globalKpi: SectorKpi = {
      label: 'Global',
      lucroBruto: globalLucroBruto,
      faturamento: faturamentoGlobal,
      margem: globalMargem,
      prevYearLucroBruto: prevYearGlobalFat > 0 ? prevYearGlobalLB : undefined,
    }

    // Projection table
    const projectionData: ProjectionRow[] = [
      ...sectorKpis.map((k) => ({
        setor: k.label,
        faturamento: k.faturamento,
        lucroBruto: k.lucroBruto,
        margem: k.margem,
      })),
      {
        setor: 'Total',
        faturamento: faturamentoGlobal,
        lucroBruto: globalLucroBruto,
        margem: globalMargem,
      },
    ]

    // Fuel detail section (per empresa, per product)
    const fuelEmpresas: EmpresaDetail[] = []
    const empSet = new Set<number>()
    for (const key of fuelByEmpProd.keys()) {
      empSet.add(Number(key.split('-')[0]))
    }

    for (const empCodigo of empSet) {
      const products: ProductDetail[] = []
      let empLitros = 0
      let empFat = 0
      let empCusto = 0

      for (const [key, agg] of fuelByEmpProd.entries()) {
        const [empStr, prodStr] = key.split('-')
        if (Number(empStr) !== empCodigo) continue
        const prodCode = Number(prodStr)
        const cost = fuelCostUnit(empCodigo, prodCode)
        const fatLiq = agg.valorTotal * fuelNetRate(prodCode)
        const lb = fatLiq - cost * agg.quantidade
        const pvPorLitro = agg.quantidade > 0 ? fatLiq / agg.quantidade : 0

        products.push({
          produtoCodigo: prodCode,
          nome: productMap.get(prodCode) ?? `Produto ${prodCode}`,
          litros: agg.quantidade,
          lucroBruto: lb,
          margem: fatLiq > 0 ? (lb / fatLiq) * 100 : 0,
          precoVenda: pvPorLitro,
          precoCusto: cost,
          lbPorLitro: agg.quantidade > 0 ? lb / agg.quantidade : 0,
        })

        empLitros += agg.quantidade
        empFat += fatLiq
        empCusto += cost * agg.quantidade
      }

      const empLB = empFat - empCusto

      fuelEmpresas.push({
        empresaCodigo: empCodigo,
        empresa: empresaMap.get(empCodigo) ?? `Empresa ${empCodigo}`,
        litros: empLitros,
        lucroBruto: empLB,
        margem: empFat > 0 ? (empLB / empFat) * 100 : 0,
        precoVenda: empLitros > 0 ? empFat / empLitros : 0,
        precoCusto: empLitros > 0 ? empCusto / empLitros : 0,
        lbPorLitro: empLitros > 0 ? empLB / empLitros : 0,
        produtos: products.sort((a, b) => b.lucroBruto - a.lucroBruto),
      })
    }
    fuelEmpresas.sort((a, b) => b.lucroBruto - a.lucroBruto)

    const fuelTotal: TotalRow = {
      litros: fuelLitros,
      lucroBruto: fuelLucroBruto,
      margem: fuelMargem,
      precoVenda: fuelLitros > 0 ? fuelFaturamento / fuelLitros : 0,
      precoCusto: fuelLitros > 0 ? fuelCusto / fuelLitros : 0,
      lbPorLitro: fuelLitros > 0 ? fuelLucroBruto / fuelLitros : 0,
    }

    // Non-fuel per-empresa: VENDA_RESUMO total - ABASTECIMENTO total per empresa
    const resumoByEmp = new Map<number, { total: number; quantidade: number }>()
    for (const r of resumoAtual) {
      if (!matchesEmpresa(r.codigoEmpresa)) continue
      const prev = resumoByEmp.get(r.codigoEmpresa) ?? { total: 0, quantidade: 0 }
      resumoByEmp.set(r.codigoEmpresa, {
        total: prev.total + r.total,
        quantidade: prev.quantidade + r.quantidade,
      })
    }

    const buildNonFuelSectorDetail = (splitRatio: number, marginRate: number): { empresas: EmpresaDetail[]; total: TotalRow } => {
      const nonFuelEmpresas: EmpresaDetail[] = []
      let totQtd = 0
      let totFat = 0
      let totLB = 0

      for (const [empCodigo, resumo] of resumoByEmp.entries()) {
        const fuelEmp = fuelByEmp.get(empCodigo)
        const fuelFat = fuelEmp?.valorTotal ?? 0
        const empNonFuelFat = Math.max(0, resumo.total - fuelFat) * splitRatio
        const empNonFuelQtd = resumo.quantidade * splitRatio
        if (empNonFuelFat <= 0) continue

        const lb = empNonFuelFat * marginRate
        const tm = empNonFuelQtd > 0 ? empNonFuelFat / empNonFuelQtd : 0
        const pm = empNonFuelQtd > 0 ? empNonFuelFat / empNonFuelQtd : 0
        const cm = empNonFuelQtd > 0 ? (empNonFuelFat - lb) / empNonFuelQtd : 0

        nonFuelEmpresas.push({
          empresaCodigo: empCodigo,
          empresa: empresaMap.get(empCodigo) ?? `Empresa ${empCodigo}`,
          litros: 0,
          lucroBruto: lb,
          margem: marginRate * 100,
          precoVenda: 0,
          precoCusto: 0,
          lbPorLitro: 0,
          produtos: [],
          quantidade: Math.round(empNonFuelQtd),
          faturamento: empNonFuelFat,
          precoMedio: pm,
          custoMedio: cm,
          ticketMedio: tm,
        })

        totQtd += empNonFuelQtd
        totFat += empNonFuelFat
        totLB += lb
      }

      nonFuelEmpresas.sort((a, b) => (b.faturamento ?? 0) - (a.faturamento ?? 0))

      return {
        empresas: nonFuelEmpresas,
        total: {
          litros: 0,
          lucroBruto: totLB,
          margem: totFat > 0 ? (totLB / totFat) * 100 : 0,
          precoVenda: 0,
          precoCusto: 0,
          lbPorLitro: 0,
          quantidade: Math.round(totQtd),
          faturamento: totFat,
          precoMedio: totQtd > 0 ? totFat / totQtd : 0,
          custoMedio: totQtd > 0 ? (totFat - totLB) / totQtd : 0,
          ticketMedio: totQtd > 0 ? totFat / totQtd : 0,
        },
      }
    }

    const sectorDetails: Record<Setor, { empresas: EmpresaDetail[]; total: TotalRow }> = {
      combustivel: { empresas: fuelEmpresas, total: fuelTotal },
      automotivos: buildNonFuelSectorDetail(0.30, autoMarginRate),
      conveniencia: buildNonFuelSectorDetail(0.70, convMarginRate),
    }

    // --- Comparison: usa prevMonthAgg/prevYearAgg pré-computados (cache ou live) ---
    const nonFuelMargin = autoMarginRate * 0.30 + convMarginRate * 0.70
    const cmpPrevMonthNonFuelFat = Math.max(0, prevMonthAgg.vendasTotal - prevMonthAgg.fuelFat)
    const cmpPrevYearNonFuelFat = Math.max(0, prevYearAgg.vendasTotal - prevYearAgg.fuelFat)
    const prevMonthAbastCount = cachePrevMonth.isCacheHit
      ? cachePrevMonth.rows.reduce((s, r) => matchesEmpresa(r.empresa_codigo) ? s + r.fuel_abast_count : s, 0)
      : abastPrevMonth.filter((a) => matchesEmpresa(a.empresaCodigo)).length

    const comparison: PeriodComparison = {
      prevMonth: {
        faturamento: prevMonthAgg.vendasTotal,
        lucroBruto: prevMonthAgg.fuelLB + cmpPrevMonthNonFuelFat * nonFuelMargin,
        abastecimentos: prevMonthAbastCount,
      },
      prevYear: {
        faturamento: prevYearAgg.vendasTotal,
        lucroBruto: prevYearAgg.fuelLB + cmpPrevYearNonFuelFat * nonFuelMargin,
      },
    }

    // --- Quick Stats ---
    const totalAbastecimentos = filteredAbast.length
    const receitaDia = faturamentoGlobal
    const ticketMedio = totalAbastecimentos > 0 ? fuelFaturamento / totalAbastecimentos : 0
    // Non-fuel products: estimate quantity from VENDA_RESUMO quantities minus fuel abastecimentos
    const totalResumoQtd = resumoAtual.reduce((acc, r) => {
      if (!matchesEmpresa(r.codigoEmpresa)) return acc
      return acc + r.quantidade
    }, 0)
    const produtosVendidos = Math.max(0, totalResumoQtd - totalAbastecimentos)
    const margemMedia = globalMargem

    const quickStats: QuickStats = {
      litrosVendidos: fuelLitros,
      totalAbastecimentos,
      receitaDia,
      ticketMedio,
      produtosVendidos,
      margemMedia,
    }

    // --- Sales Evolution (daily aggregation) ---
    const fuelByDay = new Map<string, number>()
    for (const a of filteredAbast) {
      if (!a.dataFiscal) continue
      const day = a.dataFiscal.slice(0, 10)
      fuelByDay.set(day, (fuelByDay.get(day) ?? 0) + a.valorTotal)
    }

    // Distribute non-fuel revenue proportionally across days based on fuel distribution
    const totalFuelDays = Array.from(fuelByDay.values()).reduce((s, v) => s + v, 0)
    const salesEvolution: SalesEvolutionPoint[] = Array.from(fuelByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, fuelRev]) => {
        const proportion = totalFuelDays > 0 ? fuelRev / totalFuelDays : 0
        return {
          date,
          fuelRevenue: fuelRev,
          nonFuelRevenue: nonFuelFat * proportion,
        }
      })

    // --- Frentista Ranking ---
    const funcNameMap = new Map<number, string>()
    for (const f of funcionariosData ?? []) {
      funcNameMap.set(f.funcionarioCodigo, f.nome)
    }

    const frentistaAgg = new Map<number, { litros: number; receita: number; atendimentos: number }>()
    for (const a of filteredAbast) {
      if (!a.codigoFrentista || a.codigoFrentista <= 0) continue
      const prev = frentistaAgg.get(a.codigoFrentista) ?? { litros: 0, receita: 0, atendimentos: 0 }
      frentistaAgg.set(a.codigoFrentista, {
        litros: prev.litros + a.quantidade,
        receita: prev.receita + a.valorTotal,
        atendimentos: prev.atendimentos + 1,
      })
    }
    const frentistaRanking: FrentistaRankingItem[] = Array.from(frentistaAgg.entries())
      .map(([codigoFrentista, data]) => ({
        codigoFrentista,
        nome: funcNameMap.get(codigoFrentista) ?? `Frentista ${codigoFrentista}`,
        ...data,
      }))
      .sort((a, b) => b.litros - a.litros)
      .slice(0, 10)

    return { sectorKpis, globalKpi, projectionData, sectorDetails, comparison, quickStats, salesEvolution, frentistaRanking }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumoAtual, resumoPrevMonth, resumoPrevYear, abastecimentos, abastPrevMonth, abastPrevYear, lmcData, fuelVenda, produtosData, empresas, empresaCodigos, funcionariosData, cache.isCacheHit, cache.rows, cachePrevMonth.isCacheHit, cachePrevMonth.rows, cachePrevYear.isCacheHit, cachePrevYear.rows])

  // Após carregar live com sucesso em mês fechado elegível, popula o cache em
  // background. Próxima visita lê do Supabase instantâneamente. Idempotente
  // via ref — não dispara várias vezes pro mesmo período. v2 grava SÓ os dias
  // fechados (hoje é volátil — dados ainda chegando — então fica de fora).
  const populatedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!cache.isEligible || cache.isCacheHit || cache.isChecking) return
    if (!rede?.id) return
    if (!cache.split.closedDays) return  // só hoje no período, nada pra cachear
    // Espera as queries live terminarem (dados disponíveis)
    if (abastecimentos.length === 0 || resumoAtual.length === 0) return
    if (isLoadingAbast || isLoadingResumo || isLoadingLmc) return

    const { dataInicial: closedIni, dataFinal: closedEnd } = cache.split.closedDays
    const key = `${rede.id}|${closedIni}|${closedEnd}|${empresasPermitidasCodes.slice().sort().join(',')}`
    if (populatedRef.current === key) return
    populatedRef.current = key

    const rows = computeApuracaoRows({
      redeId: rede.id,
      empresaCodigos: empresasPermitidasCodes,
      dataInicial: closedIni,
      dataFinal: closedEnd,
      abastecimentos,
      lmc: lmcData,
      vendaResumo: resumoAtual,
      produtos: produtosData,
    })
    upsertApuracaoDiaria(rows).catch(() => { /* não bloqueia UX se falhar */ })
  }, [
    cache.isEligible, cache.isCacheHit, cache.isChecking, cache.split.closedDays,
    rede?.id,
    abastecimentos, resumoAtual, lmcData, produtosData,
    isLoadingAbast, isLoadingResumo, isLoadingLmc,
    empresasPermitidasCodes,
  ])

  return {
    ...computed,
    isLoading: isLoading || cache.isChecking,
    /** True quando os números vêm do snapshot Supabase (carregamento instantâneo). */
    isCacheHit: cache.isCacheHit,
  }
}

export default useDashboardData
