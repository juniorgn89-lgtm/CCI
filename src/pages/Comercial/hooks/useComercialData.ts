import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { useFilterStore } from '@/store/filters'
import { fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { offsetPeriod, todayLocal } from '@/lib/period'

/**
 * Backbone de dados do módulo Comercial (combustível). REDE-WIDE, fato-based:
 * reusa `useRedeSetores().combustivel` (cache apuracao_vendas + custo LMC) e
 * cruza com o FRESCOR do custo de reposição (LMC `dataMovimento`).
 *
 * Tudo aqui é FATO (margem/L, volume, LB, ranking). A única ESTIMATIVA exposta
 * é `ganhoPotencial3Piores` (teto: gap × volume, volume constante) — rotulada
 * como estimativa na UI. Nada é escrito; só GET.
 */

export interface ComercialFuelRow {
  produtoCodigo: number
  nome: string
  litros: number
  faturamento: number
  lucroBruto: number
  /** Margem por litro (R$/L) = LB ÷ litros. */
  margemL: number
  precoVenda: number
  precoCusto: number
  /** true quando o produto tem custo de reposição apurado (precoCusto > 0). */
  comCusto: boolean
}

export interface ComercialPostoRow {
  empresaCodigo: number
  posto: string
  litros: number
  faturamento: number
  lucroBruto: number
  /** Margem por litro do posto (R$/L). */
  margemL: number
  precoVenda: number
  precoCusto: number
  /** (margemL − média da rede) ÷ média × 100. */
  vsRedePct: number
  /** Data do custo de reposição mais recente do posto (LMC, precoCusto>0). */
  custoDate: string | null
  /** Dias desde `custoDate` (frescor). null se sem data. */
  custoStaleDays: number | null
  /** % do volume com custo de reposição apurado (>0). <100 = margem parcial. */
  coberturaCustoPct: number
  produtos: ComercialFuelRow[]
}

export interface ComercialData {
  postos: ComercialPostoRow[]
  /** Margem/L média da rede, ponderada por volume. */
  redeMargemL: number
  redeLitros: number
  redeLucroBruto: number
  best: ComercialPostoRow | null
  worst: ComercialPostoRow | null
  /** ESTIMATIVA (teto): R$ no período se os 3 piores subirem à média da rede. */
  ganhoPotencial3Piores: number
  /** Frescor agregado da rede: data de custo mais antiga entre os postos. */
  custoDateMaisAntiga: string | null
  custoStaleDaysMax: number | null
  isLoading: boolean
  hasRede: boolean
}

const diffDays = (fromIso: string, toIso: string): number => {
  const a = new Date(`${fromIso}T00:00:00`)
  const b = new Date(`${toIso}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

// Comercial é REDE-WIDE (compara postos entre si) → ignora o filtro de empresa.
// Referência estável pra não recomputar o memo do useRedeSetores. Ver moduloRedeWide.
const REDE_WIDE: number[] = []

const useComercialData = (): ComercialData => {
  const rede = useRedeSetores({ empresaCodigos: REDE_WIDE })
  const { dataFinal } = useFilterStore()

  const empresaCodigos = useMemo(
    () => rede.combustivel.postos.map((p) => p.empresaCodigo),
    [rede.combustivel.postos],
  )

  // Frescor do custo: LMC dos últimos 3 meses, data da última carga (precoCusto>0)
  // por POSTO. Nível posto (não produto) é robusto a alias de código LMC×venda —
  // e a sonda mostrou data uniforme por posto. Lookback 3m garante pegar a última.
  const lmcIni = useMemo(() => offsetPeriod(dataFinal, 3), [dataFinal])
  const { data: lmcRows = [] } = useQuery({
    queryKey: ['comercial-lmc-frescor', empresaCodigos.join(','), lmcIni, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchLmc({
          empresaCodigo: empresaCodigos,
          dataInicial: lmcIni,
          dataFinal,
          ultimoCodigo: p.ultimoCodigo,
          limite: p.limite,
        }),
        1000, 50,
      ),
    enabled: empresaCodigos.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  })

  return useMemo(() => {
    const hoje = todayLocal()

    // data de custo mais recente (precoCusto>0) por posto
    const custoDateByEmp = new Map<number, string>()
    for (const l of lmcRows) {
      if (l.precoCusto <= 0 || !l.dataMovimento) continue
      const cur = custoDateByEmp.get(l.empresaCodigo)
      if (!cur || l.dataMovimento > cur) custoDateByEmp.set(l.empresaCodigo, l.dataMovimento)
    }

    const redeMargemL = rede.combustivel.lucroPorUnidade // já ponderado por volume
    const redeLitros = rede.combustivel.qtd
    const redeLucroBruto = rede.combustivel.lucroBruto

    const postos: ComercialPostoRow[] = rede.combustivel.postos.map((p) => {
      const produtos: ComercialFuelRow[] = p.produtos.map((pr) => ({
        produtoCodigo: pr.produtoCodigo,
        nome: pr.produto,
        litros: pr.qtd,
        faturamento: pr.qtd * pr.precoVenda,
        lucroBruto: pr.lucroBruto,
        margemL: pr.lbPorUnidade,
        precoVenda: pr.precoVenda,
        precoCusto: pr.precoCusto,
        comCusto: pr.precoCusto > 0,
      }))
      const litrosComCusto = produtos.reduce((s, pr) => (pr.comCusto ? s + pr.litros : s), 0)
      const coberturaCustoPct = p.qtd > 0 ? (litrosComCusto / p.qtd) * 100 : 0
      const custoDate = custoDateByEmp.get(p.empresaCodigo) ?? null
      return {
        empresaCodigo: p.empresaCodigo,
        posto: p.posto,
        litros: p.qtd,
        faturamento: p.faturamento,
        lucroBruto: p.lucroBruto,
        margemL: p.lbPorUnidade,
        precoVenda: p.precoVenda,
        precoCusto: p.precoCusto,
        vsRedePct: redeMargemL > 0 ? ((p.lbPorUnidade - redeMargemL) / redeMargemL) * 100 : 0,
        custoDate,
        custoStaleDays: custoDate ? diffDays(custoDate, hoje) : null,
        coberturaCustoPct,
        produtos: produtos.sort((a, b) => b.litros - a.litros),
      }
    })

    const ranked = [...postos].sort((a, b) => b.margemL - a.margemL)
    const best = ranked[0] ?? null
    const worst = ranked[ranked.length - 1] ?? null

    // Estimativa (teto): 3 piores abaixo da média sobem à média, volume constante.
    const piores = [...postos]
      .filter((p) => p.margemL < redeMargemL && p.litros > 0)
      .sort((a, b) => a.margemL - b.margemL)
      .slice(0, 3)
    const ganhoPotencial3Piores = piores.reduce(
      (s, p) => s + (redeMargemL - p.margemL) * p.litros,
      0,
    )

    // frescor agregado: data de custo mais antiga entre os postos com data
    let custoDateMaisAntiga: string | null = null
    for (const p of postos) {
      if (p.custoDate && (!custoDateMaisAntiga || p.custoDate < custoDateMaisAntiga)) {
        custoDateMaisAntiga = p.custoDate
      }
    }
    const custoStaleDaysMax = custoDateMaisAntiga ? diffDays(custoDateMaisAntiga, hoje) : null

    return {
      postos: ranked,
      redeMargemL,
      redeLitros,
      redeLucroBruto,
      best,
      worst,
      ganhoPotencial3Piores,
      custoDateMaisAntiga,
      custoStaleDaysMax,
      isLoading: rede.isLoading,
      hasRede: rede.hasRede,
    }
  }, [rede, lmcRows])
}

export default useComercialData
