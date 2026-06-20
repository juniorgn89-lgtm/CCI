import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { LMC } from '@/api/types/combustivel'

/**
 * Reconciliação de combustível via /LMC (Livro de Movimentação de Combustíveis)
 * pro drill-down do card "Litros Vendidos".
 *
 * Por produto, no período/empresa do filtro global:
 *   abertura(1º dia) + Σentrada − Σsaida = teórico (escritural)
 *   vs fechamento(último dia) = medido
 *   = perda/sobra (medido − teórico) — em litros e %.
 *
 * `saida` do LMC = os litros vendidos do card (bate fiscal). O /LMC respeita
 * empresaCodigo (diferente do /ABASTECIMENTO, que vaza a rede) — ainda assim
 * filtramos no cliente por segurança.
 */

export type ReconStatus = 'ok' | 'atencao' | 'alerta'

/** Faixas de status sobre |perda %| (ajustável). */
export const RECON_OK_PCT = 0.5
export const RECON_ATENCAO_PCT = 1.0

const statusOf = (pct: number | null): ReconStatus => {
  if (pct === null) return 'ok'
  const a = Math.abs(pct)
  return a <= RECON_OK_PCT ? 'ok' : a <= RECON_ATENCAO_PCT ? 'atencao' : 'alerta'
}

export interface ReconRow {
  produtoCodigo: number
  nome: string
  abertura: number
  entrada: number
  saida: number
  /** Estoque teórico = abertura + entrada − saida. */
  teorico: number
  /** Estoque medido (fechamento do último dia). */
  fechamento: number
  /** Perda(−)/Sobra(+) = fechamento − teórico. */
  perdaSobra: number
  /** Perda/sobra em % sobre a saída (null quando saída = 0). */
  perdaPct: number | null
  status: ReconStatus
}

export interface ReconTotais {
  abertura: number
  entrada: number
  saida: number
  teorico: number
  fechamento: number
  perdaSobra: number
  perdaPct: number | null
}

export interface ReconData {
  rows: ReconRow[]
  totais: ReconTotais
  isLoading: boolean
  hasEmpresa: boolean
}

interface Acc {
  entrada: number
  saida: number
  minData: string
  abertura: number
  maxData: string
  fechamento: number
}

const useLmcReconciliacao = (enabled = true): ReconData => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const { data: lmcData = [], isLoading } = useQuery({
    queryKey: ['lmc-reconciliacao', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchLmc({ empresaCodigo: empresaCodigos, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 50,
    ),
    enabled: hasEmpresa && enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  return useMemo(() => {
    // Nome por código (aliases produtoCodigo / produtoLmcCodigo / codigo).
    const nomePorCodigo = new Map<number, string>()
    for (const p of produtosData ?? []) {
      for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
        if (typeof c === 'number' && c > 0 && !nomePorCodigo.has(c)) nomePorCodigo.set(c, p.nome)
      }
    }

    const empresaSet = new Set(empresaCodigos)
    const map = new Map<number, Acc>()
    for (const l of (lmcData as LMC[])) {
      if (empresaSet.size > 0 && !empresaSet.has(l.empresaCodigo)) continue
      const pcs = l.produtoCodigo
      const pc = Array.isArray(pcs) ? pcs[0] : (pcs as unknown as number)
      if (typeof pc !== 'number') continue
      const data = (l.dataMovimento ?? '').slice(0, 10)
      const cur = map.get(pc) ?? { entrada: 0, saida: 0, minData: '9999', abertura: 0, maxData: '', fechamento: 0 }
      cur.entrada += l.entrada ?? 0
      cur.saida += l.saida ?? 0
      if (data && data < cur.minData) { cur.minData = data; cur.abertura = l.abertura ?? 0 }
      if (data && data >= cur.maxData) { cur.maxData = data; cur.fechamento = l.fechamento ?? 0 }
      map.set(pc, cur)
    }

    const rows: ReconRow[] = Array.from(map.entries())
      .map(([produtoCodigo, a]) => {
        const teorico = a.abertura + a.entrada - a.saida
        const perdaSobra = a.fechamento - teorico
        const perdaPct = a.saida > 0 ? (perdaSobra / a.saida) * 100 : null
        return {
          produtoCodigo,
          nome: nomePorCodigo.get(produtoCodigo) ?? `Produto ${produtoCodigo}`,
          abertura: a.abertura,
          entrada: a.entrada,
          saida: a.saida,
          teorico,
          fechamento: a.fechamento,
          perdaSobra,
          perdaPct,
          status: statusOf(perdaPct),
        }
      })
      .filter((r) => r.saida !== 0 || r.entrada !== 0 || r.abertura !== 0 || r.fechamento !== 0)
      .sort((x, y) => y.saida - x.saida)

    const sum = (f: (r: ReconRow) => number) => rows.reduce((s, r) => s + f(r), 0)
    const tSaida = sum((r) => r.saida)
    const tPerda = sum((r) => r.perdaSobra)
    const totais: ReconTotais = {
      abertura: sum((r) => r.abertura),
      entrada: sum((r) => r.entrada),
      saida: tSaida,
      teorico: sum((r) => r.teorico),
      fechamento: sum((r) => r.fechamento),
      perdaSobra: tPerda,
      perdaPct: tSaida > 0 ? (tPerda / tSaida) * 100 : null,
    }

    return { rows, totais, isLoading, hasEmpresa }
  }, [lmcData, produtosData, empresaCodigos, hasEmpresa, isLoading])
}

export default useLmcReconciliacao
