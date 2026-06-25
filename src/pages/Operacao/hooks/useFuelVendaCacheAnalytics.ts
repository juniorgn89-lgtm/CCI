import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { fetchVendasCache, splitPeriodAtToday, type ApuracaoVendaRow } from '@/api/supabase/apuracao'
import { useFilterStore } from '@/store/filters'
import { offsetPeriod, todayLocal } from '@/lib/period'
import type {
  FuelVendaRow,
  FuelVendaFuelType,
  FuelVendaDaily,
  FuelVendaKpis,
} from '@/pages/Operacao/hooks/useFuelVendaAnalytics'

/** Desloca uma data ISO (yyyy-MM-dd) em N dias (negativo = passado), local. */
const shiftDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

/**
 * Versão CONSOLIDADA (rede-wide) do analytics de COMBUSTÍVEL, lendo o cache
 * `apuracao_vendas` (setor='combustivel') em vez do VENDA_ITEM ao vivo. Mantém
 * a MESMA interface de `useFuelVendaAnalytics` pra ser plug-in na aba.
 *
 * Decisões (alinhadas com o usuário):
 *  - SÓ dias fechados (cache). O parcial de HOJE não entra (irrelevante no
 *    default Apurado; nota honesta na UI no escopo "Aberto").
 *  - Respeita `empresaCodigos`: `[]` = rede inteira; subconjunto = consolidado
 *    daquele recorte. O fetch é rede-wide (RLS) e o filtro é client-side, então
 *    trocar de posto NÃO refaz fetch (instantâneo).
 *  - `apuracao_vendas` é agregado por (empresa, dia, produto): NÃO há
 *    granularidade de frentista/bico (funcionarioCodigo/bicoCodigo = 0). Essa
 *    aba não usa esses campos no consolidado — o ritmo de bomba/frentista
 *    continua por-posto (live) e só aparece com 1 posto selecionado.
 */
const useFuelVendaCacheAnalytics = () => {
  const rede = useTenantStore((s) => s.rede)
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1

  // Comparativo "mesmos dias decorridos": corta o fim em hoje antes de deslocar.
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const prevInicial = offsetPeriod(dataInicial, cmpOffset)
  const prevFinal = offsetPeriod(fimEfetivo, cmpOffset)
  // Semana anterior = MESMO intervalo deslocado 7 dias atrás (coluna "Var. semanal").
  const semanaAntInicial = shiftDays(dataInicial, -7)
  const semanaAntFinal = shiftDays(dataFinal, -7)

  // Período corrente: só os dias FECHADOS (cache). `todayPart` é descartado.
  const split = splitPeriodAtToday(dataInicial, dataFinal)
  const closedIni = split.closedDays?.dataInicial ?? ''
  const closedEnd = split.closedDays?.dataFinal ?? ''

  // Fetch rede-wide (sem empresaCodigos → todas as permitidas via RLS), keyed só
  // pelo range → mudar o filtro de posto re-agrega no cliente, sem refetch.
  const { data: curRows = [], isLoading } = useQuery({
    queryKey: ['fuel-cache-vendas', rede?.id, closedIni, closedEnd],
    queryFn: () => fetchVendasCache({ dataInicial: closedIni, dataFinal: closedEnd }),
    enabled: !!rede && !!closedIni && !!closedEnd,
    staleTime: 5 * 60 * 1000,
  })
  const { data: prevRows = [] } = useQuery({
    queryKey: ['fuel-cache-vendas', rede?.id, prevInicial, prevFinal],
    queryFn: () => fetchVendasCache({ dataInicial: prevInicial, dataFinal: prevFinal }),
    enabled: !!rede && !!prevInicial && !!prevFinal,
    staleTime: 5 * 60 * 1000,
  })
  const { data: semRows = [] } = useQuery({
    queryKey: ['fuel-cache-vendas', rede?.id, semanaAntInicial, semanaAntFinal],
    queryFn: () => fetchVendasCache({ dataInicial: semanaAntInicial, dataFinal: semanaAntFinal }),
    enabled: !!rede && !!semanaAntInicial && !!semanaAntFinal,
    staleTime: 5 * 60 * 1000,
  })

  return useMemo(() => {
    const matchEmpresa = (code: number) =>
      empresaCodigos.length === 0 || empresaCodigos.includes(code)
    const isFuel = (r: ApuracaoVendaRow) => r.setor === 'combustivel'
    const nome = (r: ApuracaoVendaRow) => r.produto_nome || `Produto ${r.produto_codigo}`

    // Linhas do período (já agregadas por empresa/dia/produto no cache).
    const rows: FuelVendaRow[] = []
    for (const r of curRows) {
      if (!isFuel(r) || !matchEmpresa(r.empresa_codigo)) continue
      if (r.quantidade <= 0) continue
      rows.push({
        data: r.data,
        produtoCodigo: r.produto_codigo,
        combustivelNome: nome(r),
        litros: r.quantidade,
        faturamento: r.total_venda,
        desconto: r.descontos,
        acrescimo: r.acrescimos,
        custo: r.total_custo,
        lucroBruto: r.total_venda - r.total_custo,
        funcionarioCodigo: 0,
        bicoCodigo: 0,
      })
    }

    // Período anterior (cards de KPI) — totais.
    let pLitros = 0, pFat = 0, pCusto = 0
    for (const r of prevRows) {
      if (!isFuel(r) || !matchEmpresa(r.empresa_codigo)) continue
      if (r.quantidade <= 0) continue
      pLitros += r.quantidade; pFat += r.total_venda; pCusto += r.total_custo
    }

    // Semana anterior (−7 dias) — linhas, litros por combustível e total.
    let semanaAntLitros = 0
    const semanaLitrosByFuel = new Map<string, number>()
    const rowsSemanaAnt: FuelVendaRow[] = []
    for (const r of semRows) {
      if (!isFuel(r) || !matchEmpresa(r.empresa_codigo)) continue
      if (r.quantidade <= 0) continue
      const n = nome(r)
      semanaAntLitros += r.quantidade
      semanaLitrosByFuel.set(n, (semanaLitrosByFuel.get(n) ?? 0) + r.quantidade)
      rowsSemanaAnt.push({
        data: r.data,
        produtoCodigo: r.produto_codigo,
        combustivelNome: n,
        litros: r.quantidade,
        faturamento: r.total_venda,
        desconto: r.descontos,
        acrescimo: r.acrescimos,
        custo: r.total_custo,
        lucroBruto: r.total_venda - r.total_custo,
        funcionarioCodigo: 0,
        bicoCodigo: 0,
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

    return { rows, rowsSemanaAnt, dailyData, fuelTypeData, kpis, cmp, semanaAntLitros, hasEmpresa: true, isLoading }
  }, [curRows, prevRows, semRows, empresaCodigos, isLoading])
}

export default useFuelVendaCacheAnalytics
