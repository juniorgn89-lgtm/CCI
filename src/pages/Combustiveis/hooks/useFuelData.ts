import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchAbastecimentos, fetchBombas, fetchBicos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const offsetPeriod = (dateStr: string, monthsBack: number): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - monthsBack)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface FuelKpiData {
  litros: number
  faturamento: number
  lucroBruto: number
  margemPercent: number
  precoMedioVenda: number
  precoCustoMedio: number
  lbPorLitro: number
  totalAbastecimentos: number
  ticketMedio: number
  prevMonth: { litros: number; faturamento: number; lucroBruto: number }
  prevYear: { litros: number; faturamento: number; lucroBruto: number }
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

export interface MonthlyRow {
  mes: string
  litros: number
  faturamento: number
  lucroBruto: number
}

export interface WeeklyRow {
  dia: string
  litros: number
  faturamento: number
  mediaLitros: number
  mediaFaturamento: number
}

export interface BombaRow {
  [key: string]: unknown
  bicoCodigo: number
  bicoDescricao: string
  combustivelNome: string
  litros: number
  receita: number
  lucroBruto: number
  margem: number
  totalAbastecimentos: number
  ticketMedio: number
  score: number
}

export interface FreentistaRow {
  frentistaCodigo: number
  frentistaNome: string
  litros: number
  receita: number
  lucroBruto: number
  margem: number
  totalAbastecimentos: number
  ticketMedio: number
  litrosPorAbastecimento: number
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

const useFuelData = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  const prevMonthInicial = offsetPeriod(dataInicial, 1)
  const prevMonthFinal = offsetPeriod(dataFinal, 1)
  const prevYearInicial = offsetPeriod(dataInicial, 12)
  const prevYearFinal = offsetPeriod(dataFinal, 12)
  const lmcDataInicial = offsetPeriod(dataInicial, 3)
  const evolution12mInicial = offsetPeriod(dataFinal, 11) // 12 months back from end date
  const evolution12mInicialFirst = evolution12mInicial.substring(0, 7) + '-01' // start of that month

  // Current period
  const { data: abastecimentos = [], isLoading: isLoadingAbast } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    placeholderData: keepPreviousData,
  })

  // Previous month
  const { data: prevMonthAbast = [] } = useQuery({
    queryKey: ['abastecimentos', prevMonthInicial, prevMonthFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial: prevMonthInicial, dataFinal: prevMonthFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    retry: false,
  })

  // Previous year
  const { data: prevYearAbast = [] } = useQuery({
    queryKey: ['abastecimentos', prevYearInicial, prevYearFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial: prevYearInicial, dataFinal: prevYearFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    retry: false,
  })

  // 12-month evolution data
  const { data: evolutionAbast = [] } = useQuery({
    queryKey: ['abastecimentos', evolution12mInicialFirst, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchAbastecimentos({ dataInicial: evolution12mInicialFirst, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    staleTime: 10 * 60 * 1000,
  })

  // LMC for costs
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

  // Cached reference data
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
    // Product name map — index by all possible keys
    const productMap = new Map<number, string>()
    for (const p of produtosData ?? []) {
      productMap.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) productMap.set(p.produtoLmcCodigo, p.nome)
      productMap.set(p.codigo, p.nome)
    }

    // Bico → produtoCodigo map (to resolve abastecimento product via bico chain)
    const bicoProdutoMap = new Map<number, number>()
    const bicoDescMap = new Map<number, string>()
    for (const bico of bicosData ?? []) {
      bicoProdutoMap.set(bico.bicoCodigo, bico.produtoCodigo)
      // Build a bico description: "Bomba X - Bico Y"
      const bomba = bombasData?.resultados?.find((b) => b.bombaCodigo === bico.bombaCodigo)
      bicoDescMap.set(bico.bicoCodigo, bomba ? `${bomba.descricao || bomba.bombaReferencia} - Bico ${bico.bicoNumero}` : `Bico ${bico.bicoNumero}`)
    }

    // Resolve product name: try direct codigoProduto, then via bico chain
    const getProductName = (codigoProduto: number, codigoBico: number): string => {
      const direct = productMap.get(codigoProduto)
      if (direct) return direct
      // Resolve via bico → produtoCodigo → product name
      const prodCode = bicoProdutoMap.get(codigoBico)
      if (prodCode) {
        const name = productMap.get(prodCode)
        if (name) return name
      }
      return codigoProduto ? `Combustível ${codigoProduto}` : '—'
    }

    const funcionarioMap = new Map<number, string>()
    for (const f of funcionariosData ?? []) funcionarioMap.set(f.funcionarioCodigo, f.nome)

    const bombaMap = new Map<number, string>()
    for (const b of bombasData?.resultados ?? []) bombaMap.set(b.bombaCodigo, b.descricao || `Bomba ${b.bombaReferencia}`)

    const empresaMap = new Map<number, string>()
    for (const e of empresasData?.resultados ?? []) empresaMap.set(e.codigo, e.fantasia)

    // Cost map from LMC (most recent per empresa+product)
    const costMap = new Map<string, number>()
    const sortedLmc = [...lmcData].sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento))
    for (const lmc of sortedLmc) {
      for (const prodCode of lmc.produtoCodigo) {
        const key = `${lmc.empresaCodigo}-${prodCode}`
        if (!costMap.has(key) && lmc.precoCusto > 0) costMap.set(key, lmc.precoCusto)
      }
    }
    const getCost = (emp: number, prod: number) => costMap.get(`${emp}-${prod}`) ?? 0

    // Filter by empresa(s) and skip invalid product codes
    const matchEmpresa = (code: number) => empresaCodigos.length === 0 || empresaCodigos.includes(code)
    const validProduct = (a: { codigoProduto: number }) => Number(a.codigoProduto) > 0
    const filtered = (hasEmpresa ? abastecimentos.filter((a) => matchEmpresa(a.empresaCodigo)) : abastecimentos).filter(validProduct)
    const filteredPrevMonth = (hasEmpresa ? prevMonthAbast.filter((a) => matchEmpresa(a.empresaCodigo)) : prevMonthAbast).filter(validProduct)
    const filteredPrevYear = (hasEmpresa ? prevYearAbast.filter((a) => matchEmpresa(a.empresaCodigo)) : prevYearAbast).filter(validProduct)

    // Abastecimento detail rows
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

    // Sum helper
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
    const prevMonth = sumAbast(filteredPrevMonth)
    const prevYear = sumAbast(filteredPrevYear)

    const kpis: FuelKpiData = {
      litros: current.litros,
      faturamento: current.faturamento,
      lucroBruto: current.lucroBruto,
      margemPercent: current.faturamento > 0 ? (current.lucroBruto / current.faturamento) * 100 : 0,
      precoMedioVenda: current.litros > 0 ? current.faturamento / current.litros : 0,
      precoCustoMedio: current.litros > 0 ? (current.faturamento - current.lucroBruto) / current.litros : 0,
      lbPorLitro: current.litros > 0 ? current.lucroBruto / current.litros : 0,
      totalAbastecimentos: filtered.length,
      ticketMedio: filtered.length > 0 ? current.faturamento / filtered.length : 0,
      prevMonth,
      prevYear,
    }

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
        return { data, litros: v.litros, faturamento: v.fat, custo: v.custo, lucroBruto: lb, margemPct: v.fat > 0 ? (lb / v.fat) * 100 : 0, abastecimentos: v.count, ticketMedio: v.count > 0 ? v.fat / v.count : 0 }
      })

    // Fuel type — group by product name to merge codes that share the same name
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

    // Monthly evolution — uses 12-month data, not just filtered period
    const filteredEvolution = hasEmpresa ? evolutionAbast.filter((a) => matchEmpresa(a.empresaCodigo)) : evolutionAbast
    const byMonth = new Map<string, { litros: number; fat: number; custo: number }>()
    for (const a of filteredEvolution) {
      const month = a.dataHoraAbastecimento.substring(0, 7)
      const prev = byMonth.get(month) ?? { litros: 0, fat: 0, custo: 0 }
      const cost = getCost(a.empresaCodigo, a.codigoProduto)
      byMonth.set(month, { litros: prev.litros + a.quantidade, fat: prev.fat + a.valorTotal, custo: prev.custo + cost * a.quantidade })
    }
    const monthlyEvolution: MonthlyRow[] = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, litros: v.litros, faturamento: v.fat, lucroBruto: v.fat - v.custo }))

    // Weekly
    const byWeekday = Array.from({ length: 7 }, () => ({ litros: 0, fat: 0, count: 0 }))
    for (const a of filtered) {
      const dow = new Date(a.dataHoraAbastecimento).getDay()
      byWeekday[dow].litros += a.quantidade
      byWeekday[dow].fat += a.valorTotal
      byWeekday[dow].count += 1
    }
    const weeklyAnalysis: WeeklyRow[] = byWeekday.map((v, i) => ({
      dia: WEEKDAY_LABELS[i],
      litros: v.litros, faturamento: v.fat,
      mediaLitros: v.count > 0 ? v.litros / v.count : 0,
      mediaFaturamento: v.count > 0 ? v.fat / v.count : 0,
    }))

    // Bomba/Bico data
    const byBico = new Map<number, { litros: number; fat: number; custo: number; count: number; sampleProd: number; sampleBico: number }>()
    for (const a of filtered) {
      const prev = byBico.get(a.codigoBico) ?? { litros: 0, fat: 0, custo: 0, count: 0, sampleProd: 0, sampleBico: a.codigoBico }
      const cost = getCost(a.empresaCodigo, a.codigoProduto)
      byBico.set(a.codigoBico, {
        litros: prev.litros + a.quantidade,
        fat: prev.fat + a.valorTotal,
        custo: prev.custo + cost * a.quantidade,
        count: prev.count + 1,
        sampleProd: a.codigoProduto,
        sampleBico: a.codigoBico,
      })
    }
    const bombaRaw = Array.from(byBico.entries())
      .map(([bicoCode, v]) => {
        const lb = v.fat - v.custo
        return {
          bicoCodigo: bicoCode,
          bicoDescricao: bicoDescMap.get(bicoCode) ?? `Bico ${bicoCode}`,
          combustivelNome: getProductName(v.sampleProd, v.sampleBico),
          litros: v.litros,
          receita: v.fat,
          lucroBruto: lb,
          margem: v.fat > 0 ? (lb / v.fat) * 100 : 0,
          totalAbastecimentos: v.count,
          ticketMedio: v.count > 0 ? v.fat / v.count : 0,
        }
      })

    // Compute composite score: litros (40%) + receita (35%) + margem (25%), normalized 0-100
    const maxL = Math.max(...bombaRaw.map((b) => b.litros), 1)
    const maxR = Math.max(...bombaRaw.map((b) => b.receita), 1)
    const maxM = Math.max(...bombaRaw.map((b) => b.margem), 1)
    const bombaData: BombaRow[] = bombaRaw
      .map((b) => ({
        ...b,
        score: (b.litros / maxL) * 40 + (b.receita / maxR) * 35 + (b.margem / maxM) * 25,
      }))
      .sort((a, b) => b.score - a.score)

    // Frentista data
    const byFrentista = new Map<number, { nome: string; litros: number; fat: number; custo: number; count: number }>()
    for (const r of rows) {
      if (r.frentistaCodigo === 0) continue
      const prev = byFrentista.get(r.frentistaCodigo) ?? { nome: r.frentistaNome, litros: 0, fat: 0, custo: 0, count: 0 }
      byFrentista.set(r.frentistaCodigo, {
        nome: r.frentistaNome,
        litros: prev.litros + r.litros,
        fat: prev.fat + r.valorTotal,
        custo: prev.custo + r.precoCusto * r.litros,
        count: prev.count + 1,
      })
    }
    const frentistaData: FreentistaRow[] = Array.from(byFrentista.entries())
      .map(([code, v]) => {
        const lb = v.fat - v.custo
        return {
          frentistaCodigo: code,
          frentistaNome: v.nome,
          litros: v.litros,
          receita: v.fat,
          lucroBruto: lb,
          margem: v.fat > 0 ? (lb / v.fat) * 100 : 0,
          totalAbastecimentos: v.count,
          ticketMedio: v.count > 0 ? v.fat / v.count : 0,
          litrosPorAbastecimento: v.count > 0 ? v.litros / v.count : 0,
        }
      })
      .sort((a, b) => b.litros - a.litros)

    // L.B./Litro analysis
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

    const lbLitroMonthly: LbLitroMonthly[] = monthlyEvolution.map((m) => ({
      mes: m.mes,
      lbPorLitro: m.litros > 0 ? m.lucroBruto / m.litros : 0,
      litros: m.litros,
      lucroBruto: m.lucroBruto,
    }))

    const prevMonthSum = sumAbast(filteredPrevMonth)
    const lbLitroData: LbLitroData = {
      global: kpis.lbPorLitro,
      daily: lbLitroDaily,
      byProduct: lbLitroByProduct,
      monthly: lbLitroMonthly,
      prevMonthGlobal: prevMonthSum.litros > 0 ? prevMonthSum.lucroBruto / prevMonthSum.litros : 0,
    }

    // Filter options
    const frentistas = [...new Set(rows.map((r) => r.frentistaNome))].filter((n) => n !== '—').sort()
    const combustiveis = [...new Set(rows.map((r) => r.combustivelNome))].sort()

    return { kpis, rows, dailyData, fuelTypeData, monthlyEvolution, weeklyAnalysis, bombaData, frentistaData, lbLitroData, frentistas, combustiveis }
  }, [abastecimentos, prevMonthAbast, prevYearAbast, evolutionAbast, lmcData, produtosData, funcionariosData, bombasData, bicosData, empresasData, empresaCodigos, hasEmpresa])

  return { ...computed, isLoading }
}

export default useFuelData
