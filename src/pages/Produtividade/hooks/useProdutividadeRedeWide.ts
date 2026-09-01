import { useMemo } from 'react'
import { useFilterStore } from '@/store/filters'
import useRedeProdutividadeCache from '@/pages/Produtividade/hooks/useRedeProdutividadeCache'
import { previousCalendarMonth } from '@/lib/period'
import type { FrentistaProdData, FuncProdRow, Podio } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'
import type { Empresa } from '@/api/types/empresa'

const EMPTY_KPIS = { automotivo: 0, aditivadaLitros: 0, mixPct: 0, abastecimentos: 0, ticketMedio: 0 }

type PistaPodios = FrentistaProdData['podios']

export interface FrentistaRedeWideData extends FrentistaProdData {
  /** Pódios do MÊS-CALENDÁRIO ANTERIOR (mesma estrutura cross-posto dos `podios`).
   *  Só os pódios têm versão "mês anterior" — KPIs e tabela seguem no filtro. */
  podiosPrev: PistaPodios
  /** Rows cross-posto do mês anterior — usadas só pra o contexto (métricas
   *  secundárias) dos pódios do mês anterior. */
  rowsPrev: FuncProdRow[]
  /** Rótulo curto do mês anterior, ex.: "jul/2026". */
  mesAnteriorLabel: string
}

/** Regra ÚNICA de montagem do pódio cross-posto (Top 3): filtra >0, carimba o
 *  posto do colocado (identidade composta) e ordena desc. Usada pro mês atual E
 *  pro mês anterior — não duplicar. */
const topPodio = (rows: FuncProdRow[], sel: (r: FuncProdRow) => number): Podio[] =>
  rows
    .filter((r) => sel(r) > 0)
    .map((r) => ({ funcionarioCodigo: r.funcionarioCodigo, nome: r.nome, valor: sel(r), empresaCodigo: r.empresaCodigo, postoNome: r.postoNome }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3)

const buildPistaPodios = (rows: FuncProdRow[]): PistaPodios => ({
  automotivo: topPodio(rows, (r) => r.automotivo),
  aditivada: topPodio(rows, (r) => r.aditivadaLitros),
  atendimentos: topPodio(rows, (r) => r.abastecimentos),
})

/** Achata as rows de TODOS os postos do filtro, carimbando o posto (empresaCodigo
 *  + postoNome) em cada uma — a identidade única rede-wide é (posto, funcionário). */
const flattenRows = (
  byPosto: Map<number, FrentistaProdData>,
  codes: number[],
  nomeByCod: Map<number, string | undefined>,
): { rows: FuncProdRow[]; projFactor: number } => {
  const rows: FuncProdRow[] = []
  let projFactor = 1
  for (const codigo of codes) {
    const d = byPosto.get(codigo)
    if (!d) continue
    projFactor = d.projFactor // idêntico entre postos (janela global)
    const postoNome = nomeByCod.get(codigo)
    for (const r of d.rows) rows.push({ ...r, empresaCodigo: codigo, postoNome })
  }
  return { rows, projFactor }
}

/**
 * Produtividade REDE-WIDE agregada sobre TODOS os postos do filtro (aba Visão
 * Geral). A partir de `useRedeProdutividadeCache(postoCodes).byPosto` (que já
 * computa por posto), achata as rows de todos os postos e soma os KPIs.
 *
 * KPIs = **soma** de automotivo/aditivada/gasolina/abastecimentos/cupons. Mix e
 * ticket são RECOMPUTADOS como razão dos totais (Σaditivada/Σgasolina, Σautomotivo/
 * Σcupons) — NUNCA média de razões.
 *
 * Pódios são CROSS-POSTO: achata as rows de todos os postos e ranqueia por
 * automotivo / aditivada / abastecimentos (Top 3). Cada item do pódio (e cada
 * row) carrega o posto de origem (`empresaCodigo` + `postoNome`).
 *
 * Além do período do filtro, também computa `podiosPrev` — os MESMOS pódios pro
 * MÊS-CALENDÁRIO ANTERIOR (2ª leitura do cache via `previousCalendarMonth`) —
 * pra a chave "Mês atual | Mês anterior" dos pódios. KPIs e tabela NÃO mudam.
 *
 * PEGADINHA: `funcionarioCodigo` NÃO é único entre postos (cada posto numera do
 * 1). A identidade única no modo rede-wide é a chave composta (empresaCodigo,
 * funcionarioCodigo) — carimbada em cada row/podio via `empresaCodigo`.
 */
const useProdutividadeRedeWide = (postos: Empresa[]): FrentistaRedeWideData => {
  const codes = useMemo(() => postos.map((p) => p.codigo), [postos])
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  // Mês anterior = mês-calendário antes do mês do filtro (do dataFinal, ou do
  // dataInicial se aquele faltar).
  const prev = useMemo(() => previousCalendarMonth(dataFinal || dataInicial), [dataFinal, dataInicial])

  const { byPosto, isLoading } = useRedeProdutividadeCache(codes)
  const { byPosto: byPostoPrev } = useRedeProdutividadeCache(codes, {
    period: { dataInicial: prev.dataInicial, dataFinal: prev.dataFinal },
  })

  return useMemo(() => {
    const nomeByCod = new Map(postos.map((p) => [p.codigo, p.fantasia]))

    const { rows, projFactor } = flattenRows(byPosto, codes, nomeByCod)
    const { rows: rowsPrev } = flattenRows(byPostoPrev, codes, nomeByCod)

    // KPIs somados (razão de totais para mix/ticket, não média de razões).
    const totAuto = rows.reduce((s, r) => s + r.automotivo, 0)
    const totAdit = rows.reduce((s, r) => s + r.aditivadaLitros, 0)
    const totGas = rows.reduce((s, r) => s + r.gasolinaLitros, 0)
    const totAbast = rows.reduce((s, r) => s + r.abastecimentos, 0)
    const totCupons = rows.reduce((s, r) => s + r.cupons, 0)

    return {
      rows,
      kpis: rows.length === 0 ? EMPTY_KPIS : {
        automotivo: totAuto,
        aditivadaLitros: totAdit,
        mixPct: totGas > 0 ? (totAdit / totGas) * 100 : 0,
        abastecimentos: totAbast,
        ticketMedio: totCupons > 0 ? totAuto / totCupons : 0,
      },
      podios: buildPistaPodios(rows),
      podiosPrev: buildPistaPodios(rowsPrev),
      rowsPrev,
      mesAnteriorLabel: prev.label,
      projFactor,
      isLoading,
      hasEmpresa: codes.length > 0,
    }
  }, [byPosto, byPostoPrev, postos, codes, isLoading, prev])
}

export default useProdutividadeRedeWide
