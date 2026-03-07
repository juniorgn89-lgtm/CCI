import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchAbastecimentos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

export type Setor = 'combustivel' | 'automotivos' | 'conveniencia'

export interface SectorKpi {
  label: string
  lucroBruto: number
  faturamento: number
  margem: number
  lbPorLitro?: number
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
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  // LMC lookback: fetch from 3 months before to capture most recent cost data
  const lmcDataInicial = threeMonthsBefore(dataInicial)

  // Comparison periods
  const prevMonthInicial = offsetPeriod(dataInicial, 1)
  const prevMonthFinal = offsetPeriod(dataFinal, 1)
  const prevYearInicial = offsetPeriod(dataInicial, 12)
  const prevYearFinal = offsetPeriod(dataFinal, 12)

  // VENDA_RESUMO for global faturamento per empresa (fast)
  const { data: resumoAtual = [], isLoading: isLoadingResumo } = useQuery({
    queryKey: ['vendaResumo', empresaCodigo, dataInicial, dataFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: empresaCodigo ? [empresaCodigo] : undefined,
        dataInicial,
        dataFinal,
      }),
  })

  // VENDA_RESUMO for previous month
  const { data: resumoPrevMonth = [] } = useQuery({
    queryKey: ['vendaResumoPrevMonth', empresaCodigo, prevMonthInicial, prevMonthFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: empresaCodigo ? [empresaCodigo] : undefined,
        dataInicial: prevMonthInicial,
        dataFinal: prevMonthFinal,
      }),
    retry: false,
  })

  // VENDA_RESUMO for same period last year
  const { data: resumoPrevYear = [] } = useQuery({
    queryKey: ['vendaResumoPrevYear', empresaCodigo, prevYearInicial, prevYearFinal],
    queryFn: () =>
      fetchVendaResumo({
        empresaCodigo: empresaCodigo ? [empresaCodigo] : undefined,
        dataInicial: prevYearInicial,
        dataFinal: prevYearFinal,
      }),
    retry: false,
  })

  // ABASTECIMENTO for fuel detail (fast, paginated)
  const { data: abastecimentos = [], isLoading: isLoadingAbast } = useQuery({
    queryKey: ['abastecimentos-dash', empresaCodigo, dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) =>
          fetchAbastecimentos({
            dataInicial,
            dataFinal,
            ultimoCodigo: p.ultimoCodigo,
            limite: p.limite,
          }),
        1000,
        50
      ),
  })

  // LMC for cost prices — fetch broader range (3 months back) as fallback
  const { data: lmcData = [], isLoading: isLoadingLmc } = useQuery({
    queryKey: ['lmc-dash', empresaCodigo, lmcDataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) =>
          fetchLmc({
            empresaCodigo: empresaCodigo ? [empresaCodigo] : undefined,
            dataInicial: lmcDataInicial,
            dataFinal,
            ultimoCodigo: p.ultimoCodigo,
            limite: p.limite,
          }),
        1000,
        50
      ),
  })

  // Products (cached)
  const { data: produtosData, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000,
        10
      ),
    staleTime: 30 * 60 * 1000,
  })

  // Empresas (cached)
  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const empresas = empresasData?.resultados ?? []
  const isLoading = isLoadingResumo || isLoadingAbast || isLoadingLmc || isLoadingProdutos || isLoadingEmpresas

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

    // Build cost map from LMC: empresa+produtoCodigo → most recent precoCusto
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

    // Aggregate abastecimentos by empresa → produto
    type FuelAgg = { quantidade: number; valorTotal: number; precoVendaSum: number; count: number }
    const fuelByEmpProd = new Map<string, FuelAgg>()
    const fuelByEmp = new Map<number, FuelAgg>()

    // Filter by selected empresa if needed
    const filteredAbast = empresaCodigo
      ? abastecimentos.filter((a) => a.empresaCodigo === empresaCodigo)
      : abastecimentos

    for (const a of filteredAbast) {
      const prodCode = Number(a.codigoProduto)
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
    // Split non-fuel: 30% automotivos, 70% conveniência (typical gas station ratio)
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

    const globalLucroBruto = sectorKpis.reduce((s, k) => s + k.lucroBruto, 0)
    const globalMargem = faturamentoGlobal > 0 ? (globalLucroBruto / faturamentoGlobal) * 100 : 0

    const globalKpi: SectorKpi = {
      label: 'Global',
      lucroBruto: globalLucroBruto,
      faturamento: faturamentoGlobal,
      margem: globalMargem,
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

    return { sectorKpis, globalKpi, projectionData, sectorDetails }
  }, [resumoAtual, abastecimentos, lmcData, produtosData, empresas, empresaCodigo])

  const comparison = useMemo((): PeriodComparison => {
    const sumResumo = (data: typeof resumoAtual) => {
      let fat = 0
      for (const r of data) {
        if (empresaCodigo && r.codigoEmpresa !== empresaCodigo) continue
        fat += r.total
      }
      return fat
    }

    const prevMonthFat = sumResumo(resumoPrevMonth)
    const prevYearFat = sumResumo(resumoPrevYear)

    // Estimate lucro bruto using same global margin ratio as current period
    const currentFat = computed.globalKpi.faturamento
    const currentLB = computed.globalKpi.lucroBruto
    const marginRatio = currentFat > 0 ? currentLB / currentFat : 0

    return {
      prevMonth: { faturamento: prevMonthFat, lucroBruto: prevMonthFat * marginRatio },
      prevYear: { faturamento: prevYearFat, lucroBruto: prevYearFat * marginRatio },
    }
  }, [resumoPrevMonth, resumoPrevYear, empresaCodigo, computed.globalKpi])

  return {
    ...computed,
    comparison,
    isLoading,
  }
}

export default useDashboardData
