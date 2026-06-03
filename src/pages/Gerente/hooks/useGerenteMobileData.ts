import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import useFuelVendaCost from '@/pages/Operacao/hooks/useFuelVendaCost'

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const threeMonthsBefore = (dateStr: string): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - 3)
  return fmt(d)
}

// Shift a date range back by the same number of days
const prevPeriod = (ini: string, fin: string): { prevIni: string; prevFin: string } => {
  const start = new Date(ini)
  const end = new Date(fin)
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days + 1)
  return { prevIni: fmt(prevStart), prevFin: fmt(prevEnd) }
}

const useGerenteMobileData = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  // Custo médio (CMV) + desconto de combustível por produto, via /VENDA_ITEM.
  const { vendaByProduct: fuelVenda } = useFuelVendaCost(empresaCodigos, dataInicial, dataFinal)
  const lmcDataInicial = threeMonthsBefore(dataInicial)

  const { data: resumoAtual = [], isLoading: isLoadingResumo } = useQuery({
    queryKey: ['vendaResumo', empresaCodigos, dataInicial, dataFinal],
    queryFn: () =>
      fetchVendaResumo({ empresaCodigo: hasEmpresa ? empresaCodigos : undefined, dataInicial, dataFinal }),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  const { data: abastecimentos = [], isLoading: isLoadingAbast } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  const { data: lmcData = [], isLoading: isLoadingLmc } = useQuery({
    queryKey: ['lmc', lmcDataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchLmc({ empresaCodigo: hasEmpresa ? empresaCodigos : undefined, dataInicial: lmcDataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 50
      ),
    enabled: hasEmpresa,
    placeholderData: keepPreviousData,
  })

  const { prevIni, prevFin } = prevPeriod(dataInicial, dataFinal)

  const { data: resumoPrev = [], isLoading: isLoadingResumoPrev } = useQuery({
    queryKey: ['vendaResumo', empresaCodigos, prevIni, prevFin],
    queryFn: () =>
      fetchVendaResumo({ empresaCodigo: hasEmpresa ? empresaCodigos : undefined, dataInicial: prevIni, dataFinal: prevFin }),
    enabled: hasEmpresa,
    retry: false,
  })

  const { data: abastPrev = [], isLoading: isLoadingAbastPrev } = useQuery({
    queryKey: ['abastecimentos', prevIni, prevFin],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prevIni, dataFinal: prevFin }),
    enabled: hasEmpresa,
    retry: false,
  })

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const { data: funcionariosData } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => fetchAllPages(
      (p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 10
    ),
    staleTime: 30 * 60 * 1000,
  })

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  const empresas = empresasData?.resultados ?? []
  const isLoading = isLoadingResumo || isLoadingAbast || isLoadingLmc

  const loadingStatus = {
    resumo: isLoadingResumo,
    abastecimentos: isLoadingAbast,
    lmc: isLoadingLmc,
  }

  const computed = useMemo(() => {
    const empresaMap = new Map<number, string>()
    for (const e of empresas) empresaMap.set(e.codigo, e.fantasia)

    const funcNameMap = new Map<number, string>()
    for (const f of funcionariosData ?? []) funcNameMap.set(f.funcionarioCodigo, f.nome)

    const productNameMap = new Map<number, string>()
    for (const p of produtosData ?? []) productNameMap.set(p.produtoCodigo, p.nome)

    // Cost map (LMC) — fallback. O custo principal vem do CMV (/VENDA_ITEM).
    const costMap = new Map<string, number>()
    const sortedLmc = [...lmcData].sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento))
    for (const lmc of sortedLmc) {
      for (const prodCode of lmc.produtoCodigo) {
        const key = `${lmc.empresaCodigo}-${prodCode}`
        if (!costMap.has(key) && lmc.precoCusto > 0) costMap.set(key, lmc.precoCusto)
      }
    }
    // Custo médio (CMV) por litro do item de venda; cai no LMC se não casar.
    const fuelCostUnit = (empCod: number, prodCod: number): number => {
      const v = fuelVenda.get(prodCod)
      return v && v.custoUnit > 0 ? v.custoUnit : (costMap.get(`${empCod}-${prodCod}`) ?? 0)
    }
    const filteredAbast = hasEmpresa
      ? abastecimentos.filter((a) => empresaCodigos.includes(a.empresaCodigo))
      : abastecimentos

    // Global KPIs
    const faturamentoGlobal = resumoAtual.reduce((acc, r) => {
      if (hasEmpresa && !empresaCodigos.includes(r.codigoEmpresa)) return acc
      return acc + r.total
    }, 0)

    let fuelLitros = 0
    let fuelFat = 0
    let fuelCusto = 0
    for (const a of filteredAbast) {
      const prodCode = Number(a.codigoProduto)
      if (prodCode <= 0) continue
      const cost = fuelCostUnit(a.empresaCodigo, prodCode)
      fuelLitros += a.quantidade
      fuelFat += a.valorTotal  // faturamento BRUTO (Σ valorTotal, sem desconto)
      fuelCusto += cost * a.quantidade
    }
    const fuelLB = fuelFat - fuelCusto
    const fuelMargem = fuelFat > 0 ? (fuelLB / fuelFat) * 100 : 0
    const ticketMedio = filteredAbast.length > 0 ? fuelFat / filteredAbast.length : 0

    // Product breakdown
    type ProdAgg = { nome: string; litros: number; fat: number; custo: number }
    const prodMap = new Map<number, ProdAgg>()
    for (const a of filteredAbast) {
      const prodCode = Number(a.codigoProduto)
      if (prodCode <= 0) continue
      const cost = fuelCostUnit(a.empresaCodigo, prodCode)
      const prev = prodMap.get(prodCode) ?? { nome: productNameMap.get(prodCode) ?? `Produto ${prodCode}`, litros: 0, fat: 0, custo: 0 }
      prodMap.set(prodCode, {
        nome: prev.nome,
        litros: prev.litros + a.quantidade,
        fat: prev.fat + a.valorTotal,
        custo: prev.custo + cost * a.quantidade,
      })
    }

    const combustiveis = Array.from(prodMap.entries())
      .map(([codigo, d]) => ({
        codigo,
        nome: d.nome,
        litros: d.litros,
        faturamento: d.fat,
        margem: d.fat > 0 ? ((d.fat - d.custo) / d.fat) * 100 : 0,
        participacao: fuelLitros > 0 ? (d.litros / fuelLitros) * 100 : 0,
      }))
      .sort((a, b) => b.litros - a.litros)
      .slice(0, 4)

    // Frentista ranking
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
    const frentistaRanking = Array.from(frentistaAgg.entries())
      .map(([codigo, d]) => ({
        codigo,
        nome: funcNameMap.get(codigo) ?? `Frentista ${codigo}`,
        litros: d.litros,
        receita: d.receita,
        atendimentos: d.atendimentos,
      }))
      .sort((a, b) => b.litros - a.litros)
      .slice(0, 10)

    // Por empresa (if multiple)
    const porEmpresa = Array.from(
      resumoAtual
        .filter((r) => !hasEmpresa || empresaCodigos.includes(r.codigoEmpresa))
        .reduce((acc, r) => {
          const prev = acc.get(r.codigoEmpresa) ?? { total: 0 }
          acc.set(r.codigoEmpresa, { total: prev.total + r.total })
          return acc
        }, new Map<number, { total: number }>())
        .entries()
    ).map(([codigo, d]) => ({
      codigo,
      nome: empresaMap.get(codigo) ?? `Empresa ${codigo}`,
      faturamento: d.total,
    })).sort((a, b) => b.faturamento - a.faturamento)

    // Previous period aggregates
    const prevFaturamento = resumoPrev.reduce((acc, r) => {
      if (hasEmpresa && !empresaCodigos.includes(r.codigoEmpresa)) return acc
      return acc + r.total
    }, 0)
    const prevAbast = hasEmpresa
      ? abastPrev.filter((a) => empresaCodigos.includes(a.empresaCodigo))
      : abastPrev
    const prevLitros = prevAbast.reduce((acc, a) => acc + a.quantidade, 0)
    const prevFuelFat = prevAbast.reduce((acc, a) => acc + a.valorTotal, 0)
    const prevTicket = prevAbast.length > 0 ? prevFuelFat / prevAbast.length : 0

    const delta = (current: number, previous: number): number | null => {
      if (previous === 0) return null
      return ((current - previous) / previous) * 100
    }

    const deltas = {
      faturamento: delta(faturamentoGlobal, prevFaturamento),
      litros: delta(fuelLitros, prevLitros),
      abastecimentos: delta(filteredAbast.length, prevAbast.length),
      ticketMedio: delta(ticketMedio, prevTicket),
    }

    return {
      faturamentoGlobal,
      fuelLitros,
      fuelMargem,
      totalAbastecimentos: filteredAbast.length,
      ticketMedio,
      fuelFat,
      combustiveis,
      frentistaRanking,
      porEmpresa,
      deltas,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumoAtual, resumoPrev, abastecimentos, abastPrev, lmcData, fuelVenda, empresas, empresaCodigos, funcionariosData, produtosData])

  const isLoadingDeltas = isLoadingResumoPrev || isLoadingAbastPrev

  return { ...computed, isLoading, isLoadingDeltas, loadingStatus }
}

export default useGerenteMobileData
