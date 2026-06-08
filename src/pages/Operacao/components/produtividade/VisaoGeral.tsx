import { useMemo, useState } from 'react'
import { Target, Trophy, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import { useMetasStore } from '@/store/metas'
import { SCORE_TOOLTIP, type FrentistaScore } from '@/lib/frentistaScore'
import BarCell from '@/components/tables/BarCell'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
  /** Score 0–100 por frentista (funcionarioCodigo → score). Vazio enquanto o
   * custo (lucro bruto) ainda carrega. */
  scores?: Map<number, FrentistaScore>
}

type SortKey =
  | 'nome'
  | 'score'
  | 'litros'
  | 'automotivo'
  | 'mixAditivada'
  | 'abastecimentos'
  | 'faturamento'
  | 'lucroBruto'
  | 'ticketMedio'
  | 'ticketMedioAutomotivo'
  | 'variacao'
  | 'progresso'
type SortDir = 'asc' | 'desc'

type PrimarySort = 'score' | 'litros' | 'faturamento' | 'lucro'

const PRIMARY_OPTIONS: { key: PrimarySort; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'litros', label: 'Litros' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'lucro', label: 'Lucro bruto' },
]

const PRIMARY_TO_SORT_KEY: Record<PrimarySort, SortKey> = {
  score: 'score',
  litros: 'litros',
  faturamento: 'faturamento',
  lucro: 'lucroBruto',
}

const computeMeta = (
  f: FrentistaProdRow,
  manualMode: boolean,
  manualMetas: Record<number, number>,
): number => (manualMode ? manualMetas[f.funcionarioCodigo] ?? 0 : f.prevLitros)

// Variações fora desse range indicam ausência de histórico real no mês anterior:
// > 150%  → mês anterior teve volume insignificante; frentista é virtualmente "novo"
// < -90%  → idem, ratio extremo mostra que comparativo não é confiável
const isOutlierVariation = (pct: number) => pct > 150 || pct < -90

const scoreBarColor = (s: number) =>
  s >= 75 ? 'bg-green-500' : s >= 50 ? 'bg-blue-500' : s >= 25 ? 'bg-amber-500' : 'bg-red-500'

const VisaoGeral = ({ frentistas, periodInfo, scores }: Props) => {
  const { manualMode, metas: manualMetas } = useMetasStore()
  const [primarySort, setPrimarySort] = useState<PrimarySort>('score')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Linha destacada — útil pra comparar frentistas ao analisar a tabela
  const [selected, setSelected] = useState<number | null>(null)
  const toggleSelected = (codigo: number) => {
    setSelected((curr) => (curr === codigo ? null : codigo))
  }

  const scoresReady = !!scores && scores.size > 0

  const enriched = useMemo(
    () =>
      frentistas.map((f) => {
        const meta = computeMeta(f, manualMode, manualMetas)
        const progresso = meta > 0 ? Math.min(1, f.litros / meta) : 0
        const s = scores?.get(f.funcionarioCodigo)
        return {
          ...f,
          meta,
          progresso,
          scoreVal: s ? s.score : null,
          automotivo: s?.automotivo ?? 0,
          mixAditivadaPct: s?.mixAditivadaPct ?? 0,
          abastecimentos: s?.abastecimentos ?? f.atendimentos,
          lucroBruto: s ? s.lucroBruto : null,
          ticketMedioVal: s?.ticketMedio ?? f.ticketMedio,
          ticketMedioAutomotivo: s?.ticketMedioAutomotivo ?? 0,
          coberturaCustoPct: s?.coberturaCustoPct ?? 0,
        }
      }),
    [frentistas, manualMode, manualMetas, scores]
  )

  // Atualizar ordenação primária reflete na chave de ordenação interna
  const handlePrimarySort = (key: PrimarySort) => {
    setPrimarySort(key)
    setSortKey(PRIMARY_TO_SORT_KEY[key])
    setSortDir('desc')
  }

  const sorted = useMemo(() => {
    const arr = [...enriched]
    arr.sort((a, b) => {
      // Ao ordenar por progresso, frentistas sem meta (Novo) sempre ficam no fim
      if (sortKey === 'progresso') {
        const aNoMeta = a.meta === 0
        const bNoMeta = b.meta === 0
        if (aNoMeta && !bNoMeta) return 1
        if (!aNoMeta && bNoMeta) return -1
      }
      let av: number | string = 0
      let bv: number | string = 0
      switch (sortKey) {
        case 'nome':
          av = a.nome
          bv = b.nome
          break
        case 'score':
          av = a.scoreVal ?? -Infinity
          bv = b.scoreVal ?? -Infinity
          break
        case 'litros':
          av = a.litros
          bv = b.litros
          break
        case 'automotivo':
          av = a.automotivo
          bv = b.automotivo
          break
        case 'mixAditivada':
          av = a.mixAditivadaPct
          bv = b.mixAditivadaPct
          break
        case 'abastecimentos':
          av = a.abastecimentos
          bv = b.abastecimentos
          break
        case 'faturamento':
          av = a.faturamento
          bv = b.faturamento
          break
        case 'lucroBruto':
          av = a.lucroBruto ?? -Infinity
          bv = b.lucroBruto ?? -Infinity
          break
        case 'ticketMedio':
          av = a.ticketMedioVal
          bv = b.ticketMedioVal
          break
        case 'ticketMedioAutomotivo':
          av = a.ticketMedioAutomotivo
          bv = b.ticketMedioAutomotivo
          break
        case 'variacao':
          av = a.varLitrosPct
          bv = b.varLitrosPct
          break
        case 'progresso':
          av = a.progresso
          bv = b.progresso
          break
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return arr
  }, [enriched, sortKey, sortDir])

  // Máximos por coluna pra escala das barras (data bars).
  const colMax = useMemo(() => ({
    litros: Math.max(...enriched.map((f) => f.litros), 0),
    automotivo: Math.max(...enriched.map((f) => f.automotivo), 0),
    abastecimentos: Math.max(...enriched.map((f) => f.abastecimentos), 0),
    faturamento: Math.max(...enriched.map((f) => f.faturamento), 0),
    lucroBruto: Math.max(...enriched.map((f) => f.lucroBruto ?? 0), 0),
    ticketMedio: Math.max(...enriched.map((f) => f.ticketMedioVal), 0),
    ticketAut: Math.max(...enriched.map((f) => f.ticketMedioAutomotivo), 0),
  }), [enriched])

  const handleColumnSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'nome' ? 'asc' : 'desc')
    }
  }

  // KPIs do topo
  const totalLitros = enriched.reduce((s, f) => s + f.litros, 0)
  const totalMeta = enriched.reduce((s, f) => s + f.meta, 0)
  const progressoMes = totalMeta > 0 ? totalLitros / totalMeta : 0

  // Projeção de fechamento (média geral diária × dias restantes + realizado)
  const allDaily = enriched.flatMap((f) => f.dailyLitros)
  const dailyTotalsMap = new Map<string, number>()
  for (const d of allDaily) {
    dailyTotalsMap.set(d.data, (dailyTotalsMap.get(d.data) ?? 0) + d.litros)
  }
  const sortedDaily = Array.from(dailyTotalsMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  const last7 = sortedDaily.slice(-7)
  const avgDaily = last7.length > 0 ? last7.reduce((s, [, v]) => s + v, 0) / last7.length : 0
  const projecaoFechamento = totalLitros + avgDaily * periodInfo.daysRemaining

  // Destaque do mês: maior volume absoluto de litros (independente de ter prev)
  const destaque = enriched[0] ?? null

  // Atenção: maior queda %, apenas frentistas com referência no mês anterior
  const comPrev = enriched.filter((f) => f.hasPrev)
  const atencao = comPrev.length > 0
    ? [...comPrev].sort((a, b) => a.varLitrosPct - b.varLitrosPct)[0]
    : null

  return (
    <div className="space-y-5">
      {/* KPIs do topo */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Meta do mês */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/30 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Meta do mês</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatLiters(totalLitros)}
          </p>
          <p className="text-xs tabular-nums text-gray-500">
            de {formatLiters(totalMeta)} ({(progressoMes * 100).toFixed(0)}%)
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all',
                progressoMes >= 1 ? 'bg-green-500' : progressoMes >= 0.6 ? 'bg-blue-500' : 'bg-amber-500'
              )}
              style={{ width: `${Math.min(100, progressoMes * 100)}%` }}
            />
          </div>
          {periodInfo.daysRemaining > 0 && avgDaily > 0 && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Projeção fechamento: <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(projecaoFechamento)}</span> ({periodInfo.daysRemaining} dias restantes)
            </p>
          )}
        </div>

        {/* Destaque */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-green-950/30 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Destaque do mês</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          {destaque ? (
            <>
              <p className="mt-2 truncate text-base font-bold text-gray-900 dark:text-gray-100" title={destaque.nome}>
                {destaque.nome}
              </p>
              <p className="text-xs tabular-nums text-gray-500">{formatLiters(destaque.litros)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!destaque.hasPrev || destaque.varLitrosPct > 150 ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Primeiro mês
                  </span>
                ) : (
                  <span className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                    destaque.varLitrosPct >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {destaque.varLitrosPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(destaque.varLitrosPct).toFixed(0)}% vs anterior
                  </span>
                )}
                {destaque.meta > 0 && destaque.litros >= destaque.meta && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Acima da meta
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Sem dados</p>
          )}
        </div>

        {/* Atenção */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-red-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-red-950/30 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Atenção</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          {atencao ? (
            <>
              <p className="mt-2 truncate text-base font-bold text-gray-900 dark:text-gray-100" title={atencao.nome}>
                {atencao.nome}
              </p>
              <p className="text-xs tabular-nums text-gray-500">{formatLiters(atencao.litros)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                  atencao.varLitrosPct >= 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {atencao.varLitrosPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(atencao.varLitrosPct).toFixed(0)}% vs anterior
                </span>
                {atencao.meta > 0 && atencao.litros < atencao.meta && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    Abaixo da meta
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Sem comparativo</p>
          )}
        </div>
      </div>

      {/* Tabela comparativa */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Comparativo de Frentistas
              </h3>
              {/* "?" — explica como o score é calculado */}
              <span className="group/help relative inline-flex cursor-help" tabIndex={0} aria-label="Como o score é calculado">
                <HelpCircle className="h-3.5 w-3.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200" />
                <span className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 rounded-md bg-gray-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover/help:opacity-100 group-focus/help:opacity-100 dark:bg-gray-800">
                  {SCORE_TOOLTIP}
                </span>
              </span>
            </div>
            <p className="mt-0.5 text-xs italic text-gray-400">
              Score 0–100 ponderado · comparação de desempenho entre frentistas
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {PRIMARY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handlePrimarySort(opt.key)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  primarySort === opt.key
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* Linha de grupos — agrupa as colunas por tema */}
              <tr>
                <th colSpan={3} className="px-4 py-1.5" />
                <GroupTh first label="Operação" colSpan={4} />
                <GroupTh label="Financeiro" colSpan={2} />
                <GroupTh label="Eficiência" colSpan={2} />
                <GroupTh label="Comparativo" colSpan={2} />
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <Th className="w-10">#</Th>
                <ThSort label="Frentista" k="nome" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('nome')} align="left" />
                <ThSort label="Score" k="score" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('score')} align="left" width="w-[120px]" />
                <ThSort label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('litros')} />
                <ThSort label="Automotivo" k="automotivo" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('automotivo')} />
                <ThSort label="Mix aditiv." k="mixAditivada" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('mixAditivada')} />
                <ThSort label="Abastec." k="abastecimentos" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('abastecimentos')} />
                <ThSort label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('faturamento')} groupStart />
                <ThSort label="Lucro bruto" k="lucroBruto" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('lucroBruto')} />
                <ThSort label="Ticket méd." k="ticketMedio" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('ticketMedio')} groupStart />
                <ThSort label="Ticket aut." k="ticketMedioAutomotivo" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('ticketMedioAutomotivo')} />
                <ThSort label="vs. Mês Ant." k="variacao" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('variacao')} groupStart />
                <ThSort label="Progresso" k="progresso" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('progresso')} align="left" width="w-[120px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-sm text-gray-400">
                    Sem dados de frentistas no período.
                  </td>
                </tr>
              ) : (
                sorted.map((f, idx) => {
                  const rowSelected = selected === f.funcionarioCodigo
                  return (
                    <tr
                      key={f.funcionarioCodigo}
                      onClick={() => toggleSelected(f.funcionarioCodigo)}
                      aria-selected={rowSelected}
                      className={cn(
                        'cursor-pointer transition-colors',
                        rowSelected
                          ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                          : cn('hover:bg-gray-50 dark:hover:bg-gray-800/40', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30'),
                      )}
                    >
                      <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{f.nome}</td>
                      {/* Score */}
                      <td className="w-[120px] whitespace-nowrap px-4 py-2.5">
                        {!scoresReady || f.scoreVal === null ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                              <div
                                className={cn('h-1.5 rounded-full transition-all', scoreBarColor(f.scoreVal))}
                                style={{ width: `${Math.min(100, Math.max(0, f.scoreVal))}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                              {f.scoreVal.toFixed(0)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <BarCell value={f.litros} max={colMax.litros} formatted={formatLiters(f.litros)} color="blue" align="near" />
                      </td>
                      <td className="px-2 py-2.5">
                        <BarCell value={f.automotivo} max={colMax.automotivo} formatted={formatLiters(f.automotivo)} color="blue" align="near" />
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">
                        {f.mixAditivadaPct > 0 ? `${f.mixAditivadaPct.toFixed(0).replace('.', ',')}%` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <BarCell value={f.abastecimentos} max={colMax.abastecimentos} formatted={formatNumber(f.abastecimentos)} color="blue" align="near" />
                      </td>
                      <td className="border-l border-gray-200 px-2 py-2.5 dark:border-gray-700">
                        <BarCell value={f.faturamento} max={colMax.faturamento} formatted={formatCurrency(f.faturamento)} color="green" align="near" />
                      </td>
                      <td className="px-2 py-2.5">
                        {f.lucroBruto === null
                          ? <div className="text-right text-sm text-gray-400">—</div>
                          : <BarCell value={f.lucroBruto} max={colMax.lucroBruto} formatted={formatCurrency(f.lucroBruto)} color="green" align="near" />}
                      </td>
                      <td className="border-l border-gray-200 px-2 py-2.5 dark:border-gray-700">
                        <BarCell value={f.ticketMedioVal} max={colMax.ticketMedio} formatted={formatCurrency(f.ticketMedioVal)} color="amber" align="near" />
                      </td>
                      <td className="px-2 py-2.5">
                        {f.ticketMedioAutomotivo > 0
                          ? <BarCell value={f.ticketMedioAutomotivo} max={colMax.ticketAut} formatted={formatCurrency(f.ticketMedioAutomotivo)} color="amber" align="near" />
                          : <div className="text-right text-sm text-gray-400">—</div>}
                      </td>
                      <td className={cn(
                        'border-l border-gray-200 px-4 py-2.5 text-right text-sm font-medium tabular-nums dark:border-gray-700',
                        !f.hasPrev || isOutlierVariation(f.varLitrosPct)
                          ? 'text-gray-400'
                          : f.varLitrosPct >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {!f.hasPrev || isOutlierVariation(f.varLitrosPct) ? (
                          <span
                            className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-normal text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400"
                            style={{ fontSize: '11px' }}
                            title="Sem histórico no mês anterior"
                          >
                            Novo frentista
                          </span>
                        ) : (
                          `${f.varLitrosPct >= 0 ? '+' : ''}${f.varLitrosPct.toFixed(0)}%`
                        )}
                      </td>
                      <td className="w-[120px] whitespace-nowrap px-4 py-2.5">
                        {f.meta === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                              <div
                                className={cn(
                                  'h-1.5 rounded-full transition-all',
                                  f.progresso >= 1 ? 'bg-green-500' : f.progresso >= 0.6 ? 'bg-blue-500' : 'bg-amber-500'
                                )}
                                style={{ width: `${Math.min(100, f.progresso * 100)}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[10px] tabular-nums text-gray-500">{(f.progresso * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface ThProps {
  children: React.ReactNode
  className?: string
}

const Th = ({ children, className }: ThProps) => (
  <th className={cn('px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400', className)}>
    {children}
  </th>
)

const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th
    colSpan={colSpan}
    className={cn('bg-gray-100/60 px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-gray-800/60 dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}
  >
    {label}
  </th>
)

interface ThSortProps {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: () => void
  align?: 'left' | 'right' | 'center'
  width?: string
  /** Marca o início de um grupo de colunas — desenha um divisor vertical sutil. */
  groupStart?: boolean
}

const ThSort = ({ label, k, sortKey, sortDir, onClick, align = 'right', width, groupStart }: ThSortProps) => {
  const isActive = sortKey === k
  return (
    <th className={cn(
      'whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400',
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right',
      groupStart && 'border-l border-gray-200 dark:border-gray-700',
      width
    )}>
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200',
          isActive && 'text-gray-900 dark:text-gray-100'
        )}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  )
}

export default VisaoGeral
