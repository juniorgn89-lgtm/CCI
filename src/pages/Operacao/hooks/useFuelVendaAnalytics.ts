import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useFilterStore } from '@/store/filters'
import type { VendaItem } from '@/api/types/venda'
import { offsetPeriod, todayLocal } from '@/lib/period'
import { isVendaCancelada } from '@/lib/setorClassification'

/** Desloca uma data ISO (yyyy-MM-dd) em N dias (negativo = passado), local. */
const shiftDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

/**
 * Analytics de COMBUSTÍVEL baseado na VENDA fiscal (VENDA_ITEM) — a MESMA fonte
 * do relatório "Vendas, Custo e Lucratividade" do WebPosto. Substitui o cálculo
 * por ABASTECIMENTO (bomba) nas métricas de VALOR (litros vendidos, faturamento,
 * CMV, margem, L.B./litro), pra não divergir do sistema.
 *
 * Definições (iguais ao WebPosto):
 *  - litros        = Σ quantidade
 *  - faturamento   = Σ totalVenda (BRUTO — coluna "Vendas R$")
 *  - custo (CMV)   = Σ totalCusto
 *  - lucro/margem  = faturamento − CMV
 *  - desconto/acréscimo = Σ totalDesconto / Σ totalAcrescimo (mostrados à parte)
 *  - data          = dataMovimento (uma só, confiável) — agrupado e travado no período
 *
 * Operacional (produtividade de frentista, ritmo/aferição de bomba, qualidade
 * de dados) continua em ABASTECIMENTO — outro hook.
 */

export interface FuelVendaRow {
  data: string // yyyy-MM-dd (dataMovimento)
  produtoCodigo: number
  combustivelNome: string
  litros: number
  faturamento: number // bruto (totalVenda)
  desconto: number
  acrescimo: number
  custo: number
  lucroBruto: number
  funcionarioCodigo: number
  bicoCodigo: number
}

export interface FuelVendaFuelType {
  produtoCodigo: number
  nome: string
  litros: number
  faturamento: number
  desconto: number
  acrescimo: number
  custo: number
  lucroBruto: number
  precoMedioVenda: number
  precoCustoMedio: number
  lbPorLitro: number
  margem: number
  participacao: number
  /** Variação % de litros vs período comparativo (mês/ano ant.). null = sem base. */
  variacao: number | null
}

export interface FuelVendaDaily {
  data: string
  litros: number
  faturamento: number
  custo: number
  lucroBruto: number
  margemPct: number
  count: number
}

export interface FuelVendaKpis {
  litros: number
  faturamento: number
  custo: number
  lucroBruto: number
  margemPct: number
  lbPorLitro: number
  desconto: number
  acrescimo: number
  count: number
}

const useFuelVendaAnalytics = () => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  // Comparativo "mesmos dias decorridos" (igual ao BI): corta o fim em hoje antes
  // de deslocar, pra mês corrente parcial não comparar contra período cheio do passado.
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const prevInicial = offsetPeriod(dataInicial, cmpOffset)
  const prevFinal = offsetPeriod(fimEfetivo, cmpOffset)
  // Semana anterior = MESMO intervalo deslocado 7 dias atrás. Base da coluna
  // "Variação semanal" da tabela por combustível (igual ao BI), independente do
  // toggle de comparação (que controla os cards de KPI).
  const semanaAntInicial = shiftDays(dataInicial, -7)
  const semanaAntFinal = shiftDays(dataFinal, -7)

  const matchEmpresa = (code: number) => !hasEmpresa || empresaCodigos.includes(code)

  // Catálogo de produtos — identifica combustível (combustivel=true), nome e
  // aliases de código (produtoCodigo / produtoLmcCodigo / codigo).
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const fetchFuelVendaItens = (di: string, df: string) => async (): Promise<VendaItem[]> => {
    const perEmpresa = await Promise.all(
      empresaCodigos.map((emp) =>
        fetchAllPages(
          (p) => fetchVendaItens({
            empresaCodigo: emp,
            dataInicial: di,
            dataFinal: df,
            usaProdutoLmc: false,
            ultimoCodigo: p.ultimoCodigo,
            limite: p.limite,
          }),
          1000, 50,
        ),
      ),
    )
    return perEmpresa.flat()
  }

  const { data: vendaItens = [], isLoading } = useQuery({
    queryKey: ['fuel-venda-analytics', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: fetchFuelVendaItens(dataInicial, dataFinal),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const { data: vendaItensPrev = [] } = useQuery({
    queryKey: ['fuel-venda-analytics-prev', empresaCodigos.join(','), prevInicial, prevFinal],
    queryFn: fetchFuelVendaItens(prevInicial, prevFinal),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const { data: vendaItensSemanaAnt = [] } = useQuery({
    queryKey: ['fuel-venda-analytics-semana', empresaCodigos.join(','), semanaAntInicial, semanaAntFinal],
    queryFn: fetchFuelVendaItens(semanaAntInicial, semanaAntFinal),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  return useMemo(() => {
    // Produtos de combustível + nome por código (alias-expandido).
    const fuelCodes = new Set<number>()
    const nomePorCodigo = new Map<number, string>()
    for (const p of produtosData ?? []) {
      if (p.tipoProduto !== 'C') continue  // BI: combustível = tipoProduto "C"
      for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
        if (typeof c === 'number' && c > 0) {
          fuelCodes.add(c)
          if (!nomePorCodigo.has(c)) nomePorCodigo.set(c, p.nome)
        }
      }
    }
    const isFuel = (prod: number) => fuelCodes.size === 0 || fuelCodes.has(prod)
    const day = (di: string) => di.slice(0, 10)
    const inPeriod = (d: string, di: string, df: string) => {
      const dd = day(d)
      return dd >= di && dd <= df
    }

    // Linhas de combustível do período, travadas por dataMovimento.
    const rows: FuelVendaRow[] = []
    for (const it of vendaItens) {
      if (!matchEmpresa(it.empresaCodigo)) continue
      if (isVendaCancelada(it)) continue  // BI conta só cancelada="N"
      if (it.quantidade <= 0) continue
      if (!isFuel(it.produtoCodigo)) continue
      if (!inPeriod(it.dataMovimento, dataInicial, dataFinal)) continue
      const custo = it.precoCusto * it.quantidade  // BI: Custo Combustiveis = Σ precoCusto × qtd
      rows.push({
        data: day(it.dataMovimento),
        produtoCodigo: it.produtoCodigo,
        combustivelNome: nomePorCodigo.get(it.produtoCodigo) ?? `Produto ${it.produtoCodigo}`,
        litros: it.quantidade,
        faturamento: it.totalVenda,
        desconto: it.totalDesconto,
        acrescimo: it.totalAcrescimo,
        custo,
        lucroBruto: it.totalVenda - custo,
        funcionarioCodigo: it.funcionarioCodigo,
        bicoCodigo: it.bicoCodigo,
      })
    }

    // Período anterior (comparação dos cards de KPI) — totais.
    let pLitros = 0, pFat = 0, pCusto = 0
    for (const it of vendaItensPrev) {
      if (!matchEmpresa(it.empresaCodigo)) continue
      if (isVendaCancelada(it)) continue
      if (it.quantidade <= 0 || !isFuel(it.produtoCodigo)) continue
      if (!inPeriod(it.dataMovimento, prevInicial, prevFinal)) continue
      const custo = it.precoCusto * it.quantidade
      pLitros += it.quantidade; pFat += it.totalVenda; pCusto += custo
    }

    // Semana anterior (−7 dias) — linhas, litros por combustível e total. Base
    // da coluna "Variação semanal" (tabela por combustível E tabela dia a dia).
    let semanaAntLitros = 0
    const semanaLitrosByFuel = new Map<string, number>()
    const rowsSemanaAnt: FuelVendaRow[] = []
    for (const it of vendaItensSemanaAnt) {
      if (!matchEmpresa(it.empresaCodigo)) continue
      if (isVendaCancelada(it)) continue
      if (it.quantidade <= 0 || !isFuel(it.produtoCodigo)) continue
      if (!inPeriod(it.dataMovimento, semanaAntInicial, semanaAntFinal)) continue
      const custo = it.precoCusto * it.quantidade
      const nome = nomePorCodigo.get(it.produtoCodigo) ?? `Produto ${it.produtoCodigo}`
      semanaAntLitros += it.quantidade
      semanaLitrosByFuel.set(nome, (semanaLitrosByFuel.get(nome) ?? 0) + it.quantidade)
      rowsSemanaAnt.push({
        data: day(it.dataMovimento),
        produtoCodigo: it.produtoCodigo,
        combustivelNome: nome,
        litros: it.quantidade,
        faturamento: it.totalVenda,
        desconto: it.totalDesconto,
        acrescimo: it.totalAcrescimo,
        custo,
        lucroBruto: it.totalVenda - custo,
        funcionarioCodigo: it.funcionarioCodigo,
        bicoCodigo: it.bicoCodigo,
      })
    }

    // Agregado por combustível.
    const byFuel = new Map<string, FuelVendaFuelType>()
    let totLitros = 0, totFat = 0, totCusto = 0, totDesc = 0, totAcre = 0, totCount = 0
    for (const r of rows) {
      totLitros += r.litros; totFat += r.faturamento; totCusto += r.custo
      totDesc += r.desconto; totAcre += r.acrescimo; totCount += 1
      const f = byFuel.get(r.combustivelNome) ?? {
        produtoCodigo: r.produtoCodigo, nome: r.combustivelNome,
        litros: 0, faturamento: 0, desconto: 0, acrescimo: 0, custo: 0, lucroBruto: 0,
        precoMedioVenda: 0, precoCustoMedio: 0, lbPorLitro: 0, margem: 0, participacao: 0, variacao: null,
      }
      f.litros += r.litros; f.faturamento += r.faturamento; f.custo += r.custo
      f.desconto += r.desconto; f.acrescimo += r.acrescimo; f.lucroBruto += r.lucroBruto
      byFuel.set(r.combustivelNome, f)
    }
    const fuelTypeData: FuelVendaFuelType[] = Array.from(byFuel.values()).map((f) => {
      const semL = semanaLitrosByFuel.get(f.nome) ?? 0
      return {
        ...f,
        precoMedioVenda: f.litros > 0 ? f.faturamento / f.litros : 0,
        precoCustoMedio: f.litros > 0 ? f.custo / f.litros : 0,
        lbPorLitro: f.litros > 0 ? f.lucroBruto / f.litros : 0,
        margem: f.faturamento > 0 ? (f.lucroBruto / f.faturamento) * 100 : 0,
        participacao: totLitros > 0 ? (f.litros / totLitros) * 100 : 0,
        variacao: semL > 0 ? ((f.litros - semL) / semL) * 100 : null,
      }
    }).sort((a, b) => b.faturamento - a.faturamento)

    // Agregado por dia.
    const byDay = new Map<string, FuelVendaDaily>()
    for (const r of rows) {
      const d = byDay.get(r.data) ?? { data: r.data, litros: 0, faturamento: 0, custo: 0, lucroBruto: 0, margemPct: 0, count: 0 }
      d.litros += r.litros; d.faturamento += r.faturamento; d.custo += r.custo; d.lucroBruto += r.lucroBruto; d.count += 1
      byDay.set(r.data, d)
    }
    const dailyData: FuelVendaDaily[] = Array.from(byDay.values())
      .map((d) => ({ ...d, margemPct: d.faturamento > 0 ? (d.lucroBruto / d.faturamento) * 100 : 0 }))
      .sort((a, b) => a.data.localeCompare(b.data))

    // KPIs do período + comparação (mesmo recorte no período anterior).
    const kpis: FuelVendaKpis = {
      litros: totLitros,
      faturamento: totFat,
      custo: totCusto,
      lucroBruto: totFat - totCusto,
      margemPct: totFat > 0 ? ((totFat - totCusto) / totFat) * 100 : 0,
      lbPorLitro: totLitros > 0 ? (totFat - totCusto) / totLitros : 0,
      desconto: totDesc,
      acrescimo: totAcre,
      count: totCount,
    }

    const cmp = {
      litros: pLitros,
      faturamento: pFat,
      lucroBruto: pFat - pCusto,
      margemPct: pFat > 0 ? ((pFat - pCusto) / pFat) * 100 : 0,
      lbPorLitro: pLitros > 0 ? (pFat - pCusto) / pLitros : 0,
    }

    return { rows, rowsSemanaAnt, dailyData, fuelTypeData, kpis, cmp, semanaAntLitros, hasEmpresa, isLoading }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendaItens, vendaItensPrev, vendaItensSemanaAnt, produtosData, empresaCodigos, hasEmpresa, dataInicial, dataFinal, prevInicial, prevFinal, semanaAntInicial, semanaAntFinal, isLoading])
}

export default useFuelVendaAnalytics
