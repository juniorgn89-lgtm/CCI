import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchAbastecimentos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

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
  prevMonth: { faturamento: number; lucroBruto: number }
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

const offsetPeriod = (dateStr: string, monthsBack: number): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - monthsBack)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const useDashboardData = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()

  const hasEmpresa = empresaCodigos.length > 0

  // LMC lookback: fetch from 3 months before to capture most recent cost data
  const lmcDataInicial = threeMonthsBefore(dataInicial)

  // Comparison periods
  const prevMonthInicial = offsetPeriod(dataInicial, 1)
  const prevMonthFinal = offsetPeriod(dataFinal, 1)
  const prevYearInicial = offsetPeriod(dataInicial, 12)
  const prevYearFinal = offsetPeriod(dataFinal, 12)

  // VENDA_RESUMO for global faturamento per empresa
  const { data: resumoAtual = [], isLoading: isLoadingResumo } = useQuery({
    queryKey: ['vendaResumo', empresaCodigos, dataInicial, dataFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
        dataInicial,
        dataFinal,
      }),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  // VENDA_RESUMO for previous month
  const { data: resumoPrevMonth = [] } = useQuery({
    queryKey: ['vendaResumoPrevMonth', empresaCodigos, prevMonthInicial, prevMonthFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
        dataInicial: prevMonthInicial,
        dataFinal: prevMonthFinal,
      }),
    enabled: hasEmpresa,
    retry: false,
  })

  // VENDA_RESUMO for same period last year
  const { data: resumoPrevYear = [] } = useQuery({
    queryKey: ['vendaResumoPrevYear', empresaCodigos, prevYearInicial, prevYearFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
        dataInicial: prevYearInicial,
        dataFinal: prevYearFinal,
      }),
    enabled: hasEmpresa,
    retry: false,
  })

  // ABASTECIMENTO for fuel detail (shared key with Combustíveis page)
  const { data: abastecimentos = [], isLoading: isLoadingAbast } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  // ABASTECIMENTO for previous month (fuel prev month comparison)
  const { data: abastPrevMonth = [] } = useQuery({
    queryKey: ['abastecimentos', prevMonthInicial, prevMonthFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial: prevMonthInicial, dataFinal: prevMonthFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    enabled: hasEmpresa,
    retry: false,
  })

  // ABASTECIMENTO for same period last year (fuel prev year comparison)
  const { data: abastPrevYear = [] } = useQuery({
    queryKey: ['abastecimentos', prevYearInicial, prevYearFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial: prevYearInicial, dataFinal: prevYearFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    enabled: hasEmpresa,
    retry: false,
  })

  // LMC for cost prices (shared key with Combustíveis page)
  const { data: lmcData = [], isLoading: isLoadingLmc } = useQuery({
    queryKey: ['lmc', lmcDataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchLmc({
          empresaCodigo: hasEmpresa ? empresaCodigos : undefined,
          dataInicial: lmcDataInicial, dataFinal,
          ultimoCodigo: p.ultimoCodigo, limite: p.limite,
        }),
        1000, 50
      ),
    enabled: hasEmpresa,
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

  // Empresas (cached)
  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
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

  const empresas = empresasData?.resultados ?? []
  const isLoading = isLoadingResumo || isLoadingAbast || isLoadingLmc || isLoadingProdutos || isLoadingEmpresas

  // Helper: check if an empresa code matches the current filter
  const matchesEmpresa = (code: number): boolean => {
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

    // Global faturamento from VENDA_RESUMO
    const faturamentoGlobal = resumoAtual.reduce((acc, r) => acc + r.total, 0)

    // Aggregate abastecimentos by empresa -> produto
    type FuelAgg = { quantidade: number; valorTotal: number; precoVendaSum: number; count: number }
    const fuelByEmpProd = new Map<string, FuelAgg>()
    const fuelByEmp = new Map<number, FuelAgg>()

    // Filter by selected empresas
    const filteredAbast = hasEmpresa
      ? abastecimentos.filter((a) => matchesEmpresa(a.empresaCodigo))
      : abastecimentos

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
      const cost = getCost(Number(empStr), Number(prodStr))
      fuelLitros += agg.quantidade
      fuelFaturamento += agg.valorTotal
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

    // Previous year faturamento for variation calculation
    const prevYearGlobalFat = resumoPrevYear.reduce((acc, r) => {
      if (hasEmpresa && !matchesEmpresa(r.codigoEmpresa)) return acc
      return acc + r.total
    }, 0)

    // Previous year fuel faturamento from actual abastecimentos
    const filteredAbastPrevYear = hasEmpresa
      ? abastPrevYear.filter((a) => matchesEmpresa(a.empresaCodigo))
      : abastPrevYear
    const prevYearFuelFat = filteredAbastPrevYear.reduce((acc, a) => acc + a.valorTotal, 0)

    // Compute prev year fuel lucro bruto using current cost map (best estimate)
    let prevYearFuelCusto = 0
    for (const a of filteredAbastPrevYear) {
      const cost = getCost(a.empresaCodigo, Number(a.codigoProduto))
      prevYearFuelCusto += cost * a.quantidade
    }
    const prevYearFuelLB = prevYearFuelFat - prevYearFuelCusto

    // Previous year non-fuel = global - fuel
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
        const cost = getCost(empCodigo, prodCode)
        const lb = agg.valorTotal - cost * agg.quantidade
        const pvPorLitro = agg.quantidade > 0 ? agg.valorTotal / agg.quantidade : 0

        products.push({
          produtoCodigo: prodCode,
          nome: productMap.get(prodCode) ?? `Produto ${prodCode}`,
          litros: agg.quantidade,
          lucroBruto: lb,
          margem: agg.valorTotal > 0 ? (lb / agg.valorTotal) * 100 : 0,
          precoVenda: pvPorLitro,
          precoCusto: cost,
          lbPorLitro: agg.quantidade > 0 ? lb / agg.quantidade : 0,
        })

        empLitros += agg.quantidade
        empFat += agg.valorTotal
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
      if (hasEmpresa && !matchesEmpresa(r.codigoEmpresa)) continue
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

    // --- Comparison: compute prev period lucro bruto using actual fuel data ---
    const computeFuelLB = (abastData: typeof abastecimentos) => {
      const filtered = hasEmpresa
        ? abastData.filter((a) => matchesEmpresa(a.empresaCodigo))
        : abastData
      let fat = 0
      let custo = 0
      for (const a of filtered) {
        fat += a.valorTotal
        custo += getCost(a.empresaCodigo, Number(a.codigoProduto)) * a.quantidade
      }
      return { fat, lb: fat - custo }
    }

    const sumResumo = (data: typeof resumoAtual) => {
      let fat = 0
      for (const r of data) {
        if (hasEmpresa && !matchesEmpresa(r.codigoEmpresa)) continue
        fat += r.total
      }
      return fat
    }

    const prevMonthFat = sumResumo(resumoPrevMonth)
    const prevYearFat = sumResumo(resumoPrevYear)

    const prevMonthFuel = computeFuelLB(abastPrevMonth)
    const prevYearFuel = computeFuelLB(abastPrevYear)

    // Non-fuel lucro bruto = (globalFat - fuelFat) * weighted non-fuel margin
    const nonFuelMargin = autoMarginRate * 0.30 + convMarginRate * 0.70
    const cmpPrevMonthNonFuelFat = Math.max(0, prevMonthFat - prevMonthFuel.fat)
    const cmpPrevYearNonFuelFat = Math.max(0, prevYearFat - prevYearFuel.fat)

    const comparison: PeriodComparison = {
      prevMonth: {
        faturamento: prevMonthFat,
        lucroBruto: prevMonthFuel.lb + cmpPrevMonthNonFuelFat * nonFuelMargin,
      },
      prevYear: {
        faturamento: prevYearFat,
        lucroBruto: prevYearFuel.lb + cmpPrevYearNonFuelFat * nonFuelMargin,
      },
    }

    // --- Quick Stats ---
    const totalAbastecimentos = filteredAbast.length
    const receitaDia = faturamentoGlobal
    const ticketMedio = totalAbastecimentos > 0 ? fuelFaturamento / totalAbastecimentos : 0
    // Non-fuel products: estimate quantity from VENDA_RESUMO quantities minus fuel abastecimentos
    const totalResumoQtd = resumoAtual.reduce((acc, r) => {
      if (hasEmpresa && !matchesEmpresa(r.codigoEmpresa)) return acc
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
  }, [resumoAtual, resumoPrevMonth, resumoPrevYear, abastecimentos, abastPrevMonth, abastPrevYear, lmcData, produtosData, empresas, empresaCodigos, funcionariosData])

  return {
    ...computed,
    isLoading,
  }
}

export default useDashboardData
