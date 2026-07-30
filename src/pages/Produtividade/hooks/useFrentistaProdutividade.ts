import { useMemo } from 'react'
import { useFilterStore } from '@/store/filters'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useVendedoresConveniencia from '@/pages/Produtividade/hooks/useVendedoresConveniencia'
import { buildScoreInputs, type ScoreAbastRow } from '@/lib/frentistaScore'
import { todayLocal } from '@/lib/period'

/**
 * Produtividade de FRENTISTA (por posto), do jeito do design de referência: junta,
 * POR funcionário, o faturamento de "automotivos" (produtos de LOJA/pista — vem do
 * cache `apuracao_vendas_funcionario` setor=automotivos) com as métricas de
 * COMBUSTÍVEL (litros de aditivada, mix, abastecimentos — vêm ao vivo do spine de
 * abastecimentos). Duas fontes, mesma chave `funcionarioCodigo`.
 *
 * "Automotivos" = produto de loja (lubrificante/óleo), NÃO combustível automotivo.
 * "Aditivada" = gasolina premium (combustível). "Atendimentos" = nº de abastecimentos.
 * "Mix de aditivada" = litros aditivada ÷ litros de gasolina (igual ao score).
 *
 * TEND. = projeção linear de fim de mês (realizado × dias-no-mês ÷ dias-decorridos),
 * só quando o período termina no mês corrente; senão o fator é 1 (mês fechado).
 */

/** Quebra por combustível dentro de um funcionário — pro detalhe. */
export interface CombustivelBreak {
  produtoCodigo: number
  nome: string
  litros: number
  abastecimentos: number
  faturamento: number
}

export interface FuncProdRow {
  funcionarioCodigo: number
  nome: string
  ativo: boolean
  /** Faturamento de automotivos de LOJA (R$). */
  automotivo: number
  automotivoTend: number
  cupons: number
  /** Ticket médio de automotivos (faturamento ÷ cupons). */
  ticket: number
  itens: number
  /** Litros de aditivada (combustível). */
  aditivadaLitros: number
  aditivadaTend: number
  gasolinaLitros: number
  /** Mix = aditivada ÷ gasolina × 100. */
  mixPct: number
  /** Abastecimentos = atendimentos (contagem). */
  abastecimentos: number
  abastTend: number
  litros: number
  faturamentoCombustivel: number
  combustiveis: CombustivelBreak[]
}

export interface Podio {
  funcionarioCodigo: number
  nome: string
  valor: number
}

export interface FrentistaProdKpis {
  automotivo: number
  aditivadaLitros: number
  mixPct: number
  abastecimentos: number
  ticketMedio: number
}

export interface FrentistaProdData {
  rows: FuncProdRow[]
  kpis: FrentistaProdKpis
  podios: { automotivo: Podio[]; aditivada: Podio[]; atendimentos: Podio[] }
  /** Fator de projeção de fim de mês (1 = sem projeção). */
  projFactor: number
  isLoading: boolean
  hasEmpresa: boolean
}

const useFrentistaProdutividade = (postoCodigo?: number | null): FrentistaProdData => {
  const { dataFinal } = useFilterStore()
  const { abastecimentoRows, isLoading: lOper, hasEmpresa } = useOperacaoData(postoCodigo)
  const { rows: abastComCusto } = useAbastecimentosAnalytics(postoCodigo)
  const store = useVendedoresConveniencia('automotivos', postoCodigo)

  return useMemo(() => {
    // Fator de projeção de fim de mês (linear pelo ritmo do mês corrente).
    const today = todayLocal()
    const fimEf = dataFinal && dataFinal < today ? dataFinal : today
    const [fy, fm, fd] = fimEf.split('-').map(Number)
    const [ty, tm] = today.split('-').map(Number)
    const diasNoMes = new Date(fy, fm, 0).getDate()
    const projFactor = fy === ty && fm === tm && fd > 0 ? diasNoMes / fd : 1

    // Fonte de combustível: linhas com custo (analytics) senão as cruas (fallback).
    const usaCusto = abastComCusto.length > 0
    const fuelRows: ScoreAbastRow[] = usaCusto
      ? abastComCusto.map((r) => ({
          frentistaCodigo: r.frentistaCodigo,
          combustivelNome: r.combustivelNome,
          litros: r.litros,
          valorTotal: r.valorTotal,
          lucroBruto: r.lucroBruto,
          precoCusto: r.precoCusto,
        }))
      : abastecimentoRows.map((a) => ({
          frentistaCodigo: a.frentistaCodigo,
          combustivelNome: a.produtoNome,
          litros: a.litros,
          valorTotal: a.valorTotal,
          lucroBruto: 0,
          precoCusto: 0,
        }))

    // Nome por código (do combustível) — o store cobre o resto.
    const nomeByCod = new Map<number, string>()
    for (const r of abastComCusto) if (!nomeByCod.has(r.frentistaCodigo)) nomeByCod.set(r.frentistaCodigo, r.frentistaNome)
    for (const a of abastecimentoRows) if (!nomeByCod.has(a.frentistaCodigo)) nomeByCod.set(a.frentistaCodigo, a.frentistaNome)

    // Métricas de combustível por funcionário (aditivada/gasolina/abast).
    const fuelInputs = buildScoreInputs(fuelRows)

    // Quebra por combustível por funcionário (pro detalhe).
    const combByFunc = new Map<number, Map<number, CombustivelBreak>>()
    const pushComb = (cod: number, produtoCodigo: number, nome: string, litros: number, valorTotal: number) => {
      let m = combByFunc.get(cod)
      if (!m) { m = new Map(); combByFunc.set(cod, m) }
      const c = m.get(produtoCodigo) ?? { produtoCodigo, nome, litros: 0, abastecimentos: 0, faturamento: 0 }
      c.litros += litros
      c.abastecimentos += 1
      c.faturamento += valorTotal
      m.set(produtoCodigo, c)
    }
    if (usaCusto) {
      for (const r of abastComCusto) pushComb(r.frentistaCodigo, r.produtoCodigo, r.combustivelNome, r.litros, r.valorTotal)
    } else {
      for (const a of abastecimentoRows) pushComb(a.frentistaCodigo, a.produtoCodigo, a.produtoNome, a.litros, a.valorTotal)
    }

    // Store de automotivos (loja) por funcionário.
    const storeByCod = new Map(store.rows.map((r) => [r.funcionarioCodigo, r]))

    // União dos funcionários das duas fontes.
    const codes = new Set<number>([...fuelInputs.keys(), ...store.rows.map((r) => r.funcionarioCodigo)])

    const rows: FuncProdRow[] = [...codes].map((cod) => {
      const fi = fuelInputs.get(cod)
      const sv = storeByCod.get(cod)
      const aditivada = fi?.aditivadaLitros ?? 0
      const gasolina = fi?.gasolinaLitros ?? 0
      const abast = fi?.abastecimentos ?? 0
      const automotivo = sv?.faturamento ?? 0
      return {
        funcionarioCodigo: cod,
        nome: sv?.nome ?? nomeByCod.get(cod) ?? `Funcionário ${cod}`,
        ativo: sv?.ativo ?? true,
        automotivo,
        automotivoTend: automotivo * projFactor,
        cupons: sv?.cupons ?? 0,
        ticket: sv?.ticketMedio ?? 0,
        itens: sv?.itens ?? 0,
        aditivadaLitros: aditivada,
        aditivadaTend: aditivada * projFactor,
        gasolinaLitros: gasolina,
        mixPct: gasolina > 0 ? (aditivada / gasolina) * 100 : 0,
        abastecimentos: abast,
        abastTend: abast * projFactor,
        litros: fi?.litros ?? 0,
        faturamentoCombustivel: fi?.faturamento ?? 0,
        combustiveis: [...(combByFunc.get(cod)?.values() ?? [])].sort((a, b) => b.litros - a.litros),
      }
    }).sort((a, b) => b.automotivo - a.automotivo || b.aditivadaLitros - a.aditivadaLitros)

    // KPIs do posto.
    const totAdit = rows.reduce((s, r) => s + r.aditivadaLitros, 0)
    const totGas = rows.reduce((s, r) => s + r.gasolinaLitros, 0)
    const totAuto = rows.reduce((s, r) => s + r.automotivo, 0)
    const totCupons = rows.reduce((s, r) => s + r.cupons, 0)
    const kpis: FrentistaProdKpis = {
      automotivo: totAuto,
      aditivadaLitros: totAdit,
      mixPct: totGas > 0 ? (totAdit / totGas) * 100 : 0,
      abastecimentos: rows.reduce((s, r) => s + r.abastecimentos, 0),
      ticketMedio: totCupons > 0 ? totAuto / totCupons : 0,
    }

    // Pódios (top 7, só quem tem valor).
    const podio = (sel: (r: FuncProdRow) => number): Podio[] =>
      rows
        .filter((r) => sel(r) > 0)
        .map((r) => ({ funcionarioCodigo: r.funcionarioCodigo, nome: r.nome, valor: sel(r) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 7)

    return {
      rows,
      kpis,
      podios: {
        automotivo: podio((r) => r.automotivo),
        aditivada: podio((r) => r.aditivadaLitros),
        atendimentos: podio((r) => r.abastecimentos),
      },
      projFactor,
      isLoading: lOper || store.isLoading,
      hasEmpresa,
    }
  }, [abastComCusto, abastecimentoRows, store.rows, store.isLoading, lOper, hasEmpresa, dataFinal])
}

export default useFrentistaProdutividade
