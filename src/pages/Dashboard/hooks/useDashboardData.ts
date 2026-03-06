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
}

export interface TotalRow {
  litros: number
  lucroBruto: number
  margem: number
  precoVenda: number
  precoCusto: number
  lbPorLitro: number
}

const useDashboardData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

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

  // LMC for cost prices (paginated)
  const { data: lmcData = [], isLoading: isLoadingLmc } = useQuery({
    queryKey: ['lmc-dash', empresaCodigo, dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) =>
          fetchLmc({
            empresaCodigo: empresaCodigo ? [empresaCodigo] : undefined,
            dataInicial,
            dataFinal,
            ultimoCodigo: p.ultimoCodigo,
            limite: p.limite,
          }),
        1000,
        20
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

    // Build cost map from LMC: empresa+produtoLmcCodigo → average precoCusto
    // LMC produtoCodigo is an array; we use produtoLmcCodigo as the key
    const costMap = new Map<string, { total: number; count: number }>()
    for (const lmc of lmcData) {
      for (const prodCode of lmc.produtoCodigo) {
        const key = `${lmc.empresaCodigo}-${prodCode}`
        const prev = costMap.get(key) ?? { total: 0, count: 0 }
        costMap.set(key, { total: prev.total + lmc.precoCusto, count: prev.count + 1 })
      }
    }
    const getCost = (empresaCod: number, produtoCod: number): number => {
      const entry = costMap.get(`${empresaCod}-${produtoCod}`)
      return entry ? entry.total / entry.count : 0
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

      // By empresa+product
      const prev = fuelByEmpProd.get(key) ?? { quantidade: 0, valorTotal: 0, precoVendaSum: 0, count: 0 }
      fuelByEmpProd.set(key, {
        quantidade: prev.quantidade + a.quantidade,
        valorTotal: prev.valorTotal + a.valorTotal,
        precoVendaSum: prev.precoVendaSum + a.valorUnitario,
        count: prev.count + 1,
      })

      // By empresa total
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

    // Estimate other sectors from VENDA_RESUMO
    // Modelo 65 = NFC-e (typically conveniência), Modelo 55 = NF-e
    const resumoByEmpresa = new Map<number, { total55: number; total65: number }>()
    for (const r of resumoAtual) {
      const prev = resumoByEmpresa.get(r.codigoEmpresa) ?? { total55: 0, total65: 0 }
      if (r.modelo === '65') {
        prev.total65 += r.total
      } else {
        prev.total55 += r.total
      }
      resumoByEmpresa.set(r.codigoEmpresa, prev)
    }

    // Non-fuel faturamento = total from VENDA_RESUMO minus fuel
    const nonFuelFat = Math.max(0, faturamentoGlobal - fuelFaturamento)
    // Split non-fuel into automotivos vs conveniência using modelo 65 ratio
    const total65 = resumoAtual.filter((r) => r.modelo === '65').reduce((s, r) => s + r.total, 0)
    const convenienciaFat = Math.min(total65, nonFuelFat)
    const automotivosFat = Math.max(0, nonFuelFat - convenienciaFat)

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
        lucroBruto: automotivosFat * 0.66, // estimated margin
        faturamento: automotivosFat,
        margem: 66,
      },
      {
        label: 'Conveniência',
        lucroBruto: convenienciaFat * 0.50,
        faturamento: convenienciaFat,
        margem: 50,
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
        const avgPV = agg.count > 0 ? agg.precoVendaSum / agg.count : 0

        products.push({
          produtoCodigo: prodCode,
          nome: productMap.get(prodCode) ?? `Produto ${prodCode}`,
          litros: agg.quantidade,
          lucroBruto: lb,
          margem: agg.valorTotal > 0 ? (lb / agg.valorTotal) * 100 : 0,
          precoVenda: avgPV,
          precoCusto: cost,
          lbPorLitro: agg.quantidade > 0 ? lb / agg.quantidade : 0,
        })

        empLitros += agg.quantidade
        empFat += agg.valorTotal
        empCusto += cost * agg.quantidade
      }

      const empLB = empFat - empCusto
      const empAggData = fuelByEmp.get(empCodigo)

      fuelEmpresas.push({
        empresaCodigo: empCodigo,
        empresa: empresaMap.get(empCodigo) ?? `Empresa ${empCodigo}`,
        litros: empLitros,
        lucroBruto: empLB,
        margem: empFat > 0 ? (empLB / empFat) * 100 : 0,
        precoVenda: empAggData && empAggData.count > 0 ? empAggData.precoVendaSum / empAggData.count : 0,
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

    // Simple per-empresa detail for automotivos/conveniência from VENDA_RESUMO
    const buildSimpleSectorDetail = (faturamento: number, marginRate: number): { empresas: EmpresaDetail[]; total: TotalRow } => {
      // Can't break down by empresa without item data — show aggregate
      const lb = faturamento * marginRate
      return {
        empresas: [],
        total: {
          litros: 0,
          lucroBruto: lb,
          margem: faturamento > 0 ? marginRate * 100 : 0,
          precoVenda: 0,
          precoCusto: 0,
          lbPorLitro: 0,
        },
      }
    }

    const sectorDetails: Record<Setor, { empresas: EmpresaDetail[]; total: TotalRow }> = {
      combustivel: { empresas: fuelEmpresas, total: fuelTotal },
      automotivos: buildSimpleSectorDetail(automotivosFat, 0.66),
      conveniencia: buildSimpleSectorDetail(convenienciaFat, 0.50),
    }

    return { sectorKpis, globalKpi, projectionData, sectorDetails }
  }, [resumoAtual, abastecimentos, lmcData, produtosData, empresas, empresaCodigo])

  return {
    ...computed,
    isLoading,
  }
}

export default useDashboardData
