import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchBombas, fetchBicos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'

const offsetPeriod = (dateStr: string, monthsBack: number): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - monthsBack)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface AbastecimentoRow {
  codigo: number
  dataHora: string
  empresaNome: string
  empresaCodigo: number
  bombaDescricao: string
  bicoCodigo: number
  frentistaNome: string
  frentistaCodigo: number
  combustivelNome: string
  produtoCodigo: number
  litros: number
  valorUnitario: number
  valorTotal: number
  precoCusto: number
  lucroBruto: number
  margem: number
  placa: string
}

export interface DailyRow {
  data: string
  litros: number
  faturamento: number
  custo: number
  lucroBruto: number
  margemPct: number
  abastecimentos: number
  ticketMedio: number
  [key: string]: unknown
}

export interface FuelTypeRow {
  produtoCodigo: number
  nome: string
  litros: number
  faturamento: number
  custo: number
  lucroBruto: number
  precoMedioVenda: number
  precoCustoMedio: number
  lbPorLitro: number
  margem: number
  participacao: number
  [key: string]: unknown
}

export interface LbLitroDaily {
  data: string
  lbPorLitro: number
  litros: number
  lucroBruto: number
  [key: string]: unknown
}

export interface LbLitroProduct {
  nome: string
  litros: number
  lucroBruto: number
  lbPorLitro: number
  participacaoLb: number
  [key: string]: unknown
}

export interface LbLitroMonthly {
  mes: string
  lbPorLitro: number
  litros: number
  lucroBruto: number
}

export interface LbLitroData {
  global: number
  daily: LbLitroDaily[]
  byProduct: LbLitroProduct[]
  monthly: LbLitroMonthly[]
  prevMonthGlobal: number
}

export interface ProjectionMeta {
  /** Total de dias do período */
  daysTotal: number
  /** Dias decorridos do período (incluindo hoje, no máximo até dataFinal) */
  daysElapsed: number
  /** Dias restantes do período (a partir de hoje, exclusive) */
  daysRemaining: number
  /** True quando o período é projetável: tem dias decorridos e dias restantes */
  isProjectable: boolean
  /** Fator de extrapolação (daysTotal / daysElapsed). 1 quando não projetável. */
  scaleFactor: number
}

const useAbastecimentosAnalytics = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  const prevMonthInicial = offsetPeriod(dataInicial, 1)
  const prevMonthFinal = offsetPeriod(dataFinal, 1)
  const lmcDataInicial = offsetPeriod(dataInicial, 3)
  const evolution12mInicial = offsetPeriod(dataFinal, 11)
  const evolution12mInicialFirst = evolution12mInicial.substring(0, 7) + '-01'

  const { data: abastecimentos = [], isLoading: isLoadingAbast } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    placeholderData: keepPreviousData,
  })

  const { data: prevMonthAbast = [] } = useQuery({
    queryKey: ['abastecimentos', prevMonthInicial, prevMonthFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prevMonthInicial, dataFinal: prevMonthFinal }),
    retry: false,
  })

  const { data: evolutionAbast = [] } = useQuery({
    queryKey: ['abastecimentos', evolution12mInicialFirst, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: evolution12mInicialFirst, dataFinal, chunkDays: 30 }),
    staleTime: 10 * 60 * 1000,
  })

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
    placeholderData: keepPreviousData,
  })

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const { data: funcionariosData } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => fetchAllPages((p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })

  const { data: bombasData } = useQuery({
    queryKey: ['bombas'],
    queryFn: () => fetchBombas(),
    staleTime: 30 * 60 * 1000,
  })

  const { data: bicosData } = useQuery({
    queryKey: ['bicos'],
    queryFn: () => fetchAllPages((p) => fetchBicos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = isLoadingAbast || isLoadingLmc

  const computed = useMemo(() => {
    const productMap = new Map<number, string>()
    for (const p of produtosData ?? []) {
      productMap.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) productMap.set(p.produtoLmcCodigo, p.nome)
      productMap.set(p.codigo, p.nome)
    }

    const bicoProdutoMap = new Map<number, number>()
    const bicoDescMap = new Map<number, string>()
    for (const bico of bicosData ?? []) {
      bicoProdutoMap.set(bico.bicoCodigo, bico.produtoCodigo)
      const bomba = bombasData?.resultados?.find((b) => b.bombaCodigo === bico.bombaCodigo)
      bicoDescMap.set(bico.bicoCodigo, bomba ? `${bomba.descricao || bomba.bombaReferencia} - Bico ${bico.bicoNumero}` : `Bico ${bico.bicoNumero}`)
    }

    const getProductName = (codigoProduto: number, codigoBico: number): string => {
      const direct = productMap.get(codigoProduto)
      if (direct) return direct
      const prodCode = bicoProdutoMap.get(codigoBico)
      if (prodCode) {
        const name = productMap.get(prodCode)
        if (name) return name
      }
      return codigoProduto ? `Combustível ${codigoProduto}` : '—'
    }

    const funcionarioMap = new Map<number, string>()
    for (const f of funcionariosData ?? []) funcionarioMap.set(f.funcionarioCodigo, f.nome)

    const empresaMap = new Map<number, string>()
    for (const e of empresasData?.resultados ?? []) empresaMap.set(e.codigo, e.fantasia)

    const costMap = new Map<string, number>()
    const sortedLmc = [...lmcData].sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento))
    for (const lmc of sortedLmc) {
      for (const prodCode of lmc.produtoCodigo) {
        const key = `${lmc.empresaCodigo}-${prodCode}`
        if (!costMap.has(key) && lmc.precoCusto > 0) costMap.set(key, lmc.precoCusto)
      }
    }
    const getCost = (emp: number, prod: number) => costMap.get(`${emp}-${prod}`) ?? 0

    const matchEmpresa = (code: number) => empresaCodigos.length === 0 || empresaCodigos.includes(code)
    const validProduct = (a: { codigoProduto: number }) => Number(a.codigoProduto) > 0
    const filtered = (hasEmpresa ? abastecimentos.filter((a) => matchEmpresa(a.empresaCodigo)) : abastecimentos).filter(validProduct)
    const filteredPrevMonth = (hasEmpresa ? prevMonthAbast.filter((a) => matchEmpresa(a.empresaCodigo)) : prevMonthAbast).filter(validProduct)

    const rows: AbastecimentoRow[] = filtered.map((a) => {
      const cost = getCost(a.empresaCodigo, a.codigoProduto)
      const custoTotal = cost * a.quantidade
      const lb = a.valorTotal - custoTotal
      return {
        codigo: a.codigo,
        dataHora: a.dataHoraAbastecimento,
        empresaNome: empresaMap.get(a.empresaCodigo) ?? `Empresa ${a.empresaCodigo}`,
        empresaCodigo: a.empresaCodigo,
        bombaDescricao: bicoDescMap.get(a.codigoBico) ?? `Bico ${a.codigoBico}`,
        bicoCodigo: a.codigoBico,
        frentistaNome: funcionarioMap.get(a.codigoFrentista) ?? (a.codigoFrentista ? `Frentista ${a.codigoFrentista}` : '—'),
        frentistaCodigo: a.codigoFrentista,
        combustivelNome: getProductName(a.codigoProduto, a.codigoBico),
        produtoCodigo: a.codigoProduto,
        litros: a.quantidade,
        valorUnitario: a.valorUnitario,
        valorTotal: a.valorTotal,
        precoCusto: cost,
        lucroBruto: lb,
        margem: a.valorTotal > 0 ? (lb / a.valorTotal) * 100 : 0,
        placa: a.placa || '—',
      }
    })

    const sumAbast = (list: typeof abastecimentos) => {
      let litros = 0, fat = 0, custo = 0
      for (const a of list) {
        litros += a.quantidade
        fat += a.valorTotal
        custo += getCost(a.empresaCodigo, a.codigoProduto) * a.quantidade
      }
      return { litros, faturamento: fat, lucroBruto: fat - custo }
    }

    const current = sumAbast(filtered)

    // Daily
    const byDay = new Map<string, { litros: number; fat: number; custo: number; count: number }>()
    for (const a of filtered) {
      const day = a.dataHoraAbastecimento.split('T')[0]
      const prev = byDay.get(day) ?? { litros: 0, fat: 0, custo: 0, count: 0 }
      const cost = getCost(a.empresaCodigo, a.codigoProduto)
      byDay.set(day, { litros: prev.litros + a.quantidade, fat: prev.fat + a.valorTotal, custo: prev.custo + cost * a.quantidade, count: prev.count + 1 })
    }
    const dailyData: DailyRow[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => {
        const lb = v.fat - v.custo
        return {
          data,
          litros: v.litros,
          faturamento: v.fat,
          custo: v.custo,
          lucroBruto: lb,
          margemPct: v.fat > 0 ? (lb / v.fat) * 100 : 0,
          abastecimentos: v.count,
          ticketMedio: v.count > 0 ? v.fat / v.count : 0,
        }
      })

    // Fuel type
    const byFuelName = new Map<string, { litros: number; fat: number; custo: number; produtoCodigo: number }>()
    for (const a of filtered) {
      const nome = getProductName(a.codigoProduto, a.codigoBico)
      const prev = byFuelName.get(nome) ?? { litros: 0, fat: 0, custo: 0, produtoCodigo: a.codigoProduto }
      const cost = getCost(a.empresaCodigo, a.codigoProduto)
      byFuelName.set(nome, { litros: prev.litros + a.quantidade, fat: prev.fat + a.valorTotal, custo: prev.custo + cost * a.quantidade, produtoCodigo: prev.produtoCodigo })
    }
    const fuelTypeData: FuelTypeRow[] = Array.from(byFuelName.entries())
      .map(([nome, v]) => {
        const lb = v.fat - v.custo
        return {
          produtoCodigo: v.produtoCodigo,
          nome,
          litros: v.litros, faturamento: v.fat, custo: v.custo, lucroBruto: lb,
          precoMedioVenda: v.litros > 0 ? v.fat / v.litros : 0,
          precoCustoMedio: v.litros > 0 ? v.custo / v.litros : 0,
          lbPorLitro: v.litros > 0 ? lb / v.litros : 0,
          margem: v.fat > 0 ? (lb / v.fat) * 100 : 0,
          participacao: current.litros > 0 ? (v.litros / current.litros) * 100 : 0,
        }
      })
      .sort((a, b) => b.faturamento - a.faturamento)

    // L.B./Litro daily
    const lbLitroDaily: LbLitroDaily[] = dailyData.map((d) => ({
      data: d.data,
      lbPorLitro: d.litros > 0 ? d.lucroBruto / d.litros : 0,
      litros: d.litros,
      lucroBruto: d.lucroBruto,
    }))

    const lbLitroByProduct: LbLitroProduct[] = fuelTypeData
      .map((f) => ({
        nome: f.nome,
        litros: f.litros,
        lucroBruto: f.lucroBruto,
        lbPorLitro: f.lbPorLitro,
        participacaoLb: current.lucroBruto > 0 ? (f.lucroBruto / current.lucroBruto) * 100 : 0,
      }))
      .sort((a, b) => b.lbPorLitro - a.lbPorLitro)

    // Monthly evolution (12 meses) — apenas litros/lucroBruto agregados por mês
    const filteredEvolution = hasEmpresa ? evolutionAbast.filter((a) => matchEmpresa(a.empresaCodigo)) : evolutionAbast
    const byMonth = new Map<string, { litros: number; fat: number; custo: number }>()
    for (const a of filteredEvolution) {
      const month = a.dataHoraAbastecimento.substring(0, 7)
      const prev = byMonth.get(month) ?? { litros: 0, fat: 0, custo: 0 }
      const cost = getCost(a.empresaCodigo, a.codigoProduto)
      byMonth.set(month, { litros: prev.litros + a.quantidade, fat: prev.fat + a.valorTotal, custo: prev.custo + cost * a.quantidade })
    }
    const lbLitroMonthly: LbLitroMonthly[] = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => {
        const lb = v.fat - v.custo
        return {
          mes,
          lbPorLitro: v.litros > 0 ? lb / v.litros : 0,
          litros: v.litros,
          lucroBruto: lb,
        }
      })

    const prevMonthSum = sumAbast(filteredPrevMonth)
    const lbLitroData: LbLitroData = {
      global: current.litros > 0 ? current.lucroBruto / current.litros : 0,
      daily: lbLitroDaily,
      byProduct: lbLitroByProduct,
      monthly: lbLitroMonthly,
      prevMonthGlobal: prevMonthSum.litros > 0 ? prevMonthSum.lucroBruto / prevMonthSum.litros : 0,
    }

    const combustiveis = [...new Set(rows.map((r) => r.combustivelNome))].sort()

    return { rows, dailyData, fuelTypeData, lbLitroData, combustiveis }
  }, [abastecimentos, prevMonthAbast, evolutionAbast, lmcData, produtosData, funcionariosData, bombasData, bicosData, empresasData, empresaCodigos, hasEmpresa])

  const projectionMeta = useMemo<ProjectionMeta>(() => {
    if (!dataInicial || !dataFinal) {
      return { daysTotal: 0, daysElapsed: 0, daysRemaining: 0, isProjectable: false, scaleFactor: 1 }
    }
    const dayMs = 24 * 3600 * 1000
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = new Date(`${dataInicial}T00:00:00`)
    const endDate = new Date(`${dataFinal}T00:00:00`)
    const daysTotal = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1)

    if (today < startDate) {
      return { daysTotal, daysElapsed: 0, daysRemaining: daysTotal, isProjectable: false, scaleFactor: 1 }
    }
    if (today > endDate) {
      return { daysTotal, daysElapsed: daysTotal, daysRemaining: 0, isProjectable: false, scaleFactor: 1 }
    }
    const daysElapsed = Math.max(1, Math.round((today.getTime() - startDate.getTime()) / dayMs) + 1)
    const daysRemaining = Math.max(0, Math.round((endDate.getTime() - today.getTime()) / dayMs))
    const isProjectable = daysRemaining > 0 && daysElapsed > 0
    const scaleFactor = isProjectable ? daysTotal / daysElapsed : 1
    return { daysTotal, daysElapsed, daysRemaining, isProjectable, scaleFactor }
  }, [dataInicial, dataFinal])

  return { ...computed, projectionMeta, isLoading }
}

export default useAbastecimentosAnalytics
