import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import useOperacaoData, { type FrentistaRow } from '@/pages/Operacao/hooks/useOperacaoData'
import { fetchFuncionarioMeta } from '@/api/endpoints/funcionarios'
import { detectMetaTipo, type MetaTipo } from '@/lib/metaTipo'

/** Métrica selecionada no seletor da aba Metas. */
export type MetricaMeta = 'abastecimentos' | 'venda' | 'aditiv'

/** Mapeia a métrica da UI → tipo da meta cadastrada no Quality. */
const TIPO_BY_METRICA: Record<MetricaMeta, Exclude<MetaTipo, null>> = {
  abastecimentos: 'abastecimentos',
  venda: 'faturamento',
  aditiv: 'litros',
}

export interface MetaRow {
  funcionarioCodigo: number
  nome: string
  /** Meta da métrica (0 = sem meta cadastrada). */
  meta: number
  realizado: number
  /** realizado/meta×100; null quando não há meta. */
  pct: number | null
  /** % aditivada sobre o total de litros do frentista (só métrica aditiv). */
  mix: number | null
}

export interface MetasFrentistasData {
  rows: MetaRow[]
  metaTotal: number
  realizadoTotal: number
  /** Realizado só de quem tem meta (numerador do % da equipe). */
  realizadoComMeta: number
  /** % da equipe — só quem tem meta entra no denominador. */
  pctGeral: number | null
  comMeta: number
  bateram: number
  entre80e100: number
  abaixo80: number
  destaque: MetaRow | null
  atencao: MetaRow | null
  isLoading: boolean
  hasEmpresa: boolean
}

/** Meta válida se o intervalo cadastrado intersecta o período do filtro. */
const overlaps = (mIni: string, mFim: string, pIni: string, pFim: string): boolean =>
  (mIni || '0000-01-01') <= pFim && (mFim || '9999-12-31') >= pIni

/**
 * Monta, por frentista e por métrica, `{ meta, realizado, pct, mix }` + agregados
 * da equipe pra aba Metas da Produtividade. Tudo GET/read-only:
 *  - realizado: vem do `useOperacaoData` (abastecimentos do período — base ABAST,
 *    fixada pelo módulo). Abastecimentos = atendimentos · Venda Bruta = faturamento
 *    bruto · Aditivada = litros de produtos "aditiv" (Mix = aditiv ÷ total litros).
 *  - meta: cadastro do sistema de origem via `/FUNCIONARIO_META` (texto livre
 *    classificado por `detectMetaTipo`), escolhendo a linha cujo período cobre o
 *    filtro. Sem cadastro → meta 0 ("s/ meta"). NÃO há gravação.
 */
const useMetasFrentistas = (metrica: MetricaMeta, empresaCodigoOverride?: number | null): MetasFrentistasData => {
  const { empresaCodigos: filterCodes, dataInicial, dataFinal } = useFilterStore()
  // Posto explícito (seletor) tem prioridade; senão o filtro global.
  const empresaCodigos = empresaCodigoOverride !== undefined
    ? (empresaCodigoOverride !== null ? [empresaCodigoOverride] : [])
    : filterCodes
  const { frentistaRows, abastecimentoRows, isLoading: lOper, hasEmpresa } = useOperacaoData(empresaCodigoOverride)

  const { data: metasRaw = [], isLoading: lMetas } = useQuery({
    queryKey: ['funcionario-meta', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: async () => {
      const lists = await Promise.all(
        empresaCodigos.map((ec) => fetchFuncionarioMeta({ empresaCodigo: ec, limite: 1000 })),
      )
      return lists.flatMap((l) => l.resultados)
    },
    enabled: empresaCodigos.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  return useMemo<MetasFrentistasData>(() => {
    const tipo = TIPO_BY_METRICA[metrica]

    // Meta por funcionário para o tipo da métrica, cobrindo o período.
    const metaByFunc = new Map<number, number>()
    for (const m of metasRaw) {
      if (detectMetaTipo(m.descricao) !== tipo) continue
      if (!overlaps(m.dataInicial, m.dataFinal, dataInicial, dataFinal)) continue
      if (!metaByFunc.has(m.funcionarioCodigo)) metaByFunc.set(m.funcionarioCodigo, m.valor)
    }

    // Aditivada + total de litros por frentista (só quando a métrica é aditiv).
    const aditivByFunc = new Map<number, number>()
    const litrosByFunc = new Map<number, number>()
    if (metrica === 'aditiv') {
      for (const a of abastecimentoRows) {
        litrosByFunc.set(a.frentistaCodigo, (litrosByFunc.get(a.frentistaCodigo) ?? 0) + a.litros)
        if ((a.produtoNome ?? '').toLowerCase().includes('aditiv')) {
          aditivByFunc.set(a.frentistaCodigo, (aditivByFunc.get(a.frentistaCodigo) ?? 0) + a.litros)
        }
      }
    }

    const realizadoDe = (f: FrentistaRow): number =>
      metrica === 'abastecimentos' ? f.atendimentos
        : metrica === 'venda' ? f.faturamento
          : (aditivByFunc.get(f.funcionarioCodigo) ?? 0)

    const rows: MetaRow[] = frentistaRows
      .map((f) => {
        const meta = metaByFunc.get(f.funcionarioCodigo) ?? 0
        const realizado = realizadoDe(f)
        const pct = meta > 0 ? (realizado / meta) * 100 : null
        let mix: number | null = null
        if (metrica === 'aditiv') {
          const tot = litrosByFunc.get(f.funcionarioCodigo) ?? 0
          mix = tot > 0 ? (realizado / tot) * 100 : 0
        }
        return { funcionarioCodigo: f.funcionarioCodigo, nome: f.nome, meta, realizado, pct, mix }
      })
      // Mostra quem teve atividade na métrica OU tem meta cadastrada.
      .filter((r) => r.realizado > 0 || r.meta > 0)

    const comMetaRows = rows.filter((r) => r.meta > 0)
    const metaTotal = comMetaRows.reduce((s, r) => s + r.meta, 0)
    const realizadoTotal = rows.reduce((s, r) => s + r.realizado, 0)
    const realizadoComMeta = comMetaRows.reduce((s, r) => s + r.realizado, 0)
    const pctGeral = metaTotal > 0 ? (realizadoComMeta / metaTotal) * 100 : null
    const bateram = comMetaRows.filter((r) => (r.pct ?? 0) >= 100).length
    const entre80e100 = comMetaRows.filter((r) => (r.pct ?? 0) >= 80 && (r.pct ?? 0) < 100).length
    const abaixo80 = comMetaRows.filter((r) => (r.pct ?? 0) < 80).length
    const ordByPct = [...comMetaRows].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    const destaque = ordByPct[0] ?? null
    const atencao = ordByPct.length > 0 ? ordByPct[ordByPct.length - 1] : null

    return {
      rows,
      metaTotal,
      realizadoTotal,
      realizadoComMeta,
      pctGeral,
      comMeta: comMetaRows.length,
      bateram,
      entre80e100,
      abaixo80,
      destaque,
      atencao,
      isLoading: lOper || lMetas,
      hasEmpresa,
    }
  }, [metrica, metasRaw, frentistaRows, abastecimentoRows, dataInicial, dataFinal, lOper, lMetas, hasEmpresa])
}

export default useMetasFrentistas
