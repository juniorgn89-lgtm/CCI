import { useMemo } from 'react'
import useRedeProdutividadeCache from '@/pages/Produtividade/hooks/useRedeProdutividadeCache'
import type { FrentistaProdData, FuncProdRow, Podio } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'
import type { Empresa } from '@/api/types/empresa'

const EMPTY_KPIS = { automotivo: 0, aditivadaLitros: 0, mixPct: 0, abastecimentos: 0, ticketMedio: 0 }

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
 * PEGADINHA: `funcionarioCodigo` NÃO é único entre postos (cada posto numera do
 * 1). A identidade única no modo rede-wide é a chave composta (empresaCodigo,
 * funcionarioCodigo) — carimbada em cada row/podio via `empresaCodigo`.
 */
const useProdutividadeRedeWide = (postos: Empresa[]): FrentistaProdData => {
  const codes = useMemo(() => postos.map((p) => p.codigo), [postos])
  const { byPosto, isLoading } = useRedeProdutividadeCache(codes)

  return useMemo(() => {
    const nomeByCod = new Map(postos.map((p) => [p.codigo, p.fantasia]))

    // Achata as rows de TODOS os postos do filtro, carimbando o posto em cada uma.
    const rows: FuncProdRow[] = []
    let projFactor = 1
    for (const codigo of codes) {
      const d = byPosto.get(codigo)
      if (!d) continue
      projFactor = d.projFactor // idêntico entre postos (janela global)
      const postoNome = nomeByCod.get(codigo)
      for (const r of d.rows) rows.push({ ...r, empresaCodigo: codigo, postoNome })
    }

    // KPIs somados (razão de totais para mix/ticket, não média de razões).
    const totAuto = rows.reduce((s, r) => s + r.automotivo, 0)
    const totAdit = rows.reduce((s, r) => s + r.aditivadaLitros, 0)
    const totGas = rows.reduce((s, r) => s + r.gasolinaLitros, 0)
    const totAbast = rows.reduce((s, r) => s + r.abastecimentos, 0)
    const totCupons = rows.reduce((s, r) => s + r.cupons, 0)

    // Pódio cross-posto: cada item leva o posto de origem (identidade composta).
    const podio = (sel: (r: FuncProdRow) => number): Podio[] =>
      rows
        .filter((r) => sel(r) > 0)
        .map((r) => ({ funcionarioCodigo: r.funcionarioCodigo, nome: r.nome, valor: sel(r), empresaCodigo: r.empresaCodigo, postoNome: r.postoNome }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 3)

    return {
      rows,
      kpis: rows.length === 0 ? EMPTY_KPIS : {
        automotivo: totAuto,
        aditivadaLitros: totAdit,
        mixPct: totGas > 0 ? (totAdit / totGas) * 100 : 0,
        abastecimentos: totAbast,
        ticketMedio: totCupons > 0 ? totAuto / totCupons : 0,
      },
      podios: {
        automotivo: podio((r) => r.automotivo),
        aditivada: podio((r) => r.aditivadaLitros),
        atendimentos: podio((r) => r.abastecimentos),
      },
      projFactor,
      isLoading,
      hasEmpresa: codes.length > 0,
    }
  }, [byPosto, postos, codes, isLoading])
}

export default useProdutividadeRedeWide
