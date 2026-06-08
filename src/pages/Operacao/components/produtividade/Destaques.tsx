import { useMemo, useState } from 'react'
import { Award, Trophy, ArrowUp, ArrowDown, Star, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import { useMetasStore } from '@/store/metas'
import type {
  FrentistaProdRow,
  PeriodInfo,
} from '@/pages/Operacao/components/ProdutividadeTab'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
  abastecimentoRowsPrev: AbastecimentoRow[]
}

type WeekKey = 1 | 2 | 3 | 4

interface WeekRange {
  week: WeekKey
  startDay: number
  endDay: number
}

const WEEK_RANGES: WeekRange[] = [
  { week: 1, startDay: 1, endDay: 7 },
  { week: 2, startDay: 8, endDay: 14 },
  { week: 3, startDay: 15, endDay: 21 },
  { week: 4, startDay: 22, endDay: 31 },
]

const MES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Limite a partir do qual a variação % vs mês anterior é considerada outlier
// (mesma regra das outras abas — sem base de comparação real).
const isOutlierDelta = (pct: number) => Math.abs(pct) > 150

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const lastDayOfMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate() // month: 1-12

const getWeekFromDate = (yyyymmdd: string): WeekKey => {
  const day = parseInt(yyyymmdd.substring(8, 10), 10)
  if (day <= 7) return 1
  if (day <= 14) return 2
  if (day <= 21) return 3
  return 4
}

interface FrentistaDestaque {
  codigo: number
  nome: string
  totalAtual: number
  totalAnterior: number
  weeks: { current: number; prev: number; aboveMeta: boolean }[]
  weeksAbove: number
  exceptional: boolean
  varTotalPct: number
  /** Tem dado nominal no mês anterior (totalAnterior > 0) */
  hasPrev: boolean
  /** Base de comparação confiável: tem prev E variação não é outlier (>150%) */
  hasReliablePrev: boolean
}

const Destaques = ({ frentistas, abastecimentoRowsPrev }: Props) => {
  const { dataInicial } = useFilterStore()
  const { manualMode, metas: manualMetas } = useMetasStore()
  // Linha destacada nas tabelas Top 5 / Novatos — útil pra fixar visualmente um frentista
  const [selectedTop, setSelectedTop] = useState<number | null>(null)
  const [selectedNovato, setSelectedNovato] = useState<number | null>(null)
  const toggleSelectedTop = (codigo: number) => setSelectedTop((curr) => (curr === codigo ? null : codigo))
  const toggleSelectedNovato = (codigo: number) => setSelectedNovato((curr) => (curr === codigo ? null : codigo))

  // Mês atual derivado de dataInicial
  const [yearStr, monthStr] = (dataInicial ?? '').split('-')
  const currentYear = parseInt(yearStr, 10) || new Date().getFullYear()
  const currentMonth = parseInt(monthStr, 10) || new Date().getMonth() + 1
  const currentMonthName = MES_NOMES[currentMonth - 1] ?? ''

  // Mês anterior
  const prevMonthDate = new Date(currentYear, currentMonth - 2, 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonth = prevMonthDate.getMonth() + 1

  // Tamanho do mês atual (para limitar a Semana 4)
  const lastDayCurrent = lastDayOfMonth(currentYear, currentMonth)

  // Per frentista: prev daily map a partir de abastecimentoRowsPrev
  const prevDailyByFrentista = useMemo(() => {
    const map = new Map<number, Map<string, number>>()
    for (const a of abastecimentoRowsPrev) {
      const day = a.dataHora.substring(0, 10)
      if (day.length !== 10) continue
      const dm = map.get(a.frentistaCodigo) ?? new Map<string, number>()
      dm.set(day, (dm.get(day) ?? 0) + a.litros)
      map.set(a.frentistaCodigo, dm)
    }
    return map
  }, [abastecimentoRowsPrev])

  // Per frentista: weekly stats (current + prev)
  const destaques: FrentistaDestaque[] = useMemo(() => {
    return frentistas
      .map((f) => {
        // Soma current por semana (a partir de f.dailyLitros)
        const currentByWeek = [0, 0, 0, 0]
        for (const d of f.dailyLitros) {
          const dayInPeriod = d.data.substring(0, 7) === `${yearStr}-${monthStr}`
          if (!dayInPeriod) continue
          const w = getWeekFromDate(d.data) - 1
          currentByWeek[w] += d.litros
        }

        // Soma prev por semana (a partir de prevDailyByFrentista)
        const prevByWeek = [0, 0, 0, 0]
        const prevDaily = prevDailyByFrentista.get(f.funcionarioCodigo)
        if (prevDaily) {
          const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
          for (const [day, litros] of prevDaily.entries()) {
            if (day.substring(0, 7) !== prevPrefix) continue
            const w = getWeekFromDate(day) - 1
            prevByWeek[w] += litros
          }
        }

        const totalAtual = currentByWeek.reduce((s, v) => s + v, 0)
        const totalAnterior = prevByWeek.reduce((s, v) => s + v, 0)
        const meta = manualMode ? manualMetas[f.funcionarioCodigo] ?? 0 : f.prevLitros
        const hasPrev = totalAnterior > 0
        const varTotalPct = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0
        // Elegibilidade para "Excepcional" exige base de comparação CONFIÁVEL:
        // tem prev E variação não é outlier (>150% indica que o prev era
        // insignificante — frentista efetivamente novo).
        const hasReliablePrev = hasPrev && !isOutlierDelta(varTotalPct)

        // Para "aboveMeta" da semana: comparar current vs prev daquela semana
        // (se manual mode, usa meta/4 como referência semanal)
        const semanalMeta = manualMode && meta > 0 ? meta / 4 : null
        const weeks = WEEK_RANGES.map((_wr, i) => {
          const referencia = semanalMeta ?? prevByWeek[i]
          const aboveMeta = referencia > 0 && currentByWeek[i] >= referencia
          return { current: currentByWeek[i], prev: prevByWeek[i], aboveMeta }
        })
        const weeksAbove = weeks.filter((w) => w.aboveMeta).length
        // Excepcional: 3 ou 4 das 4 semanas acima da meta — exige base confiável
        const exceptional = hasReliablePrev && weeksAbove >= 3

        return {
          codigo: f.funcionarioCodigo,
          nome: f.nome,
          totalAtual,
          totalAnterior,
          weeks,
          weeksAbove,
          exceptional,
          varTotalPct,
          hasPrev,
          hasReliablePrev,
        } satisfies FrentistaDestaque
      })
      .sort((a, b) => b.totalAtual - a.totalAtual)
  }, [frentistas, prevDailyByFrentista, manualMode, manualMetas, yearStr, monthStr, prevYear, prevMonth])

  // Elegíveis: têm base de comparação confiável (histórico real, não outlier).
  const eligibles = useMemo(() => destaques.filter((d) => d.hasReliablePrev), [destaques])
  // Novatos: sem base de comparação real (mês anterior sem dados ou insignificante).
  // Não competem no ranking de excepcionais, mas o gerente pode querer ver.
  const novatos = useMemo(
    () => destaques.filter((d) => !d.hasReliablePrev && d.totalAtual > 0),
    [destaques]
  )
  const [showNovatos, setShowNovatos] = useState(false)
  const exceptionals = eligibles.filter((d) => d.exceptional)
  // Destaque do mês: maior número de semanas acima da meta entre os elegíveis;
  // empate é desfeito pelo total de litros do mês.
  const top1 = useMemo(() => {
    if (eligibles.length === 0) return null
    return [...eligibles].sort((a, b) => {
      if (b.weeksAbove !== a.weeksAbove) return b.weeksAbove - a.weeksAbove
      return b.totalAtual - a.totalAtual
    })[0]
  }, [eligibles])
  const top5 = destaques.slice(0, 5)

  // Labels de range das semanas
  const weekLabel = (w: WeekKey, isLast: boolean): string => {
    const range = WEEK_RANGES[w - 1]
    const end = isLast ? lastDayCurrent : range.endDay
    return `${String(range.startDay).padStart(2, '0')}-${String(end).padStart(2, '0')}/${String(currentMonth).padStart(2, '0')}`
  }

  // Render
  if (frentistas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <Award className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-400">Sem dados de frentistas no período.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
            <Award className="h-5 w-5 text-emerald-600" />
            Desempenho semanal — {currentMonthName} {currentYear}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Comparativo com o mesmo período do mês anterior
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: '#166534' }}
        >
          <Star className="h-3.5 w-3.5" />
          {exceptionals.length} {exceptionals.length === 1 ? 'frentista excepcional' : 'frentistas excepcionais'} este mês
        </span>
      </div>

      {/* Sem elegíveis (nenhum frentista tem histórico no mês anterior) */}
      {!top1 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <Award className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            Histórico insuficiente para calcular destaques
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Nenhum frentista tem volume registrado no mês anterior para servir de base de comparação.
          </p>
        </div>
      )}

      {/* Card destaque do mês — 1º lugar entre os elegíveis */}
      {top1 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm dark:border-green-800/40 dark:bg-green-900/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                {getInitials(top1.nome)}
              </div>
              <div>
                <p className="flex flex-wrap items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
                  {top1.nome}
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    1º lugar
                  </span>
                  {top1.exceptional && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: '#166534' }}
                    >
                      Excepcional
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  Acima da meta em {top1.weeksAbove} {top1.weeksAbove === 1 ? 'semana' : 'semanas'}
                  {top1.hasPrev && !isOutlierDelta(top1.varTotalPct) && (
                    <>
                      {' · '}
                      <span className={cn(top1.varTotalPct >= 0 ? 'text-green-700' : 'text-red-700', 'font-medium')}>
                        {top1.varTotalPct >= 0 ? '+' : ''}{top1.varTotalPct.toFixed(0)}% vs mês anterior
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Total do mês</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: '#166534' }}>
                {formatLiters(top1.totalAtual)}
              </p>
            </div>
          </div>

          {/* Grid 4 semanas */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {top1.weeks.map((w, i) => {
              const wKey = (i + 1) as WeekKey
              const delta = w.prev > 0 ? ((w.current - w.prev) / w.prev) * 100 : 0
              return (
                <div
                  key={wKey}
                  className={cn(
                    'rounded-lg border p-3',
                    w.aboveMeta
                      ? 'border-green-300 bg-white dark:border-green-700 dark:bg-gray-900'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                  )}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    Semana {wKey} · {weekLabel(wKey, wKey === 4)}
                  </p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatLiters(w.current)}
                  </p>
                  {w.prev > 0 && !isOutlierDelta(delta) ? (
                    <p className={cn(
                      'mt-0.5 flex items-center gap-0.5 text-[10px] tabular-nums',
                      delta >= 0 ? 'text-green-700' : 'text-red-700'
                    )}>
                      {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(delta).toFixed(0)}%
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[10px] text-gray-400">—</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Indicador de consistência */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Consistência semanal:</span>
            {top1.weeks.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                <span
                  className={cn(
                    'inline-block h-2.5 w-2.5 rounded-full',
                    w.aboveMeta ? 'bg-green-500' : 'bg-red-400'
                  )}
                />
                S{i + 1}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabela Top 5 */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top 5 — Performance Semanal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="w-10 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                {WEEK_RANGES.map((wr) => (
                  <th key={wr.week} className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Sem {wr.week} <span className="block font-normal text-[10px] text-gray-400">{String(wr.startDay).padStart(2, '0')}-{String(wr.week === 4 ? lastDayCurrent : wr.endDay).padStart(2, '0')}/{String(currentMonth).padStart(2, '0')}</span>
                  </th>
                ))}
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Consistência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {top5.map((d, idx) => {
                const rowSelected = selectedTop === d.codigo
                return (
                <tr
                  key={d.codigo}
                  onClick={() => toggleSelectedTop(d.codigo)}
                  aria-selected={rowSelected}
                  className={cn(
                    'cursor-pointer transition-colors',
                    rowSelected
                      ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                      : cn('hover:bg-gray-50 dark:hover:bg-gray-800/40', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30'),
                  )}
                >
                  <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{d.nome}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-center">
                      {d.exceptional ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                          style={{ backgroundColor: '#166534' }}
                        >
                          Excepcional
                        </span>
                      ) : !d.hasReliablePrev ? (
                        <span
                          className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400"
                          title="Sem base de comparação real do mês anterior — fora do ranking de excepcionais"
                        >
                          Novo
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                  {d.weeks.map((w, i) => {
                    const delta = w.prev > 0 ? ((w.current - w.prev) / w.prev) * 100 : 0
                    return (
                      <td key={i} className="px-4 py-2.5 text-right text-xs tabular-nums">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{formatLiters(w.current)}</p>
                        {w.prev > 0 && !isOutlierDelta(delta) ? (
                          <p className={cn(
                            'mt-0.5 flex items-center justify-end gap-0.5',
                            delta >= 0 ? 'text-green-700' : 'text-red-700'
                          )}>
                            {delta >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                            {Math.abs(delta).toFixed(0)}%
                          </p>
                        ) : (
                          <p className="mt-0.5 text-gray-400">—</p>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2.5">
                    <div className="flex justify-center gap-1">
                      {d.weeks.map((w, i) => (
                        <span
                          key={i}
                          title={w.aboveMeta ? `S${i + 1}: acima da meta` : `S${i + 1}: abaixo da meta`}
                          className={cn(
                            'inline-block h-2.5 w-2.5 rounded-full',
                            w.aboveMeta ? 'bg-green-500' : 'bg-red-400'
                          )}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Novatos do mês — colapsável */}
      {novatos.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <button
            onClick={() => setShowNovatos((v) => !v)}
            aria-expanded={showNovatos}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Novatos no período
              </h3>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
                {novatos.length}
              </span>
              <span className="text-xs text-gray-400">
                Sem base de comparação real do mês anterior
              </span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                showNovatos && 'rotate-180'
              )}
            />
          </button>

          {showNovatos && (
            <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                    {WEEK_RANGES.map((wr) => (
                      <th key={wr.week} className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                        Sem {wr.week}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Total mês</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Destaque do mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {novatos.map((d, idx) => {
                    let bestIdx = 0
                    for (let i = 1; i < d.weeks.length; i++) {
                      if (d.weeks[i].current > d.weeks[bestIdx].current) bestIdx = i
                    }
                    const bestValue = d.weeks[bestIdx].current
                    const weeksActive = d.weeks.filter((w) => w.current > 0).length
                    const firstHalf = d.weeks[0].current + d.weeks[1].current
                    const secondHalf = d.weeks[2].current + d.weeks[3].current
                    const growing = firstHalf > 0 && secondHalf > firstHalf * 1.3
                    const rowSelected = selectedNovato === d.codigo
                    return (
                      <tr
                        key={d.codigo}
                        onClick={() => toggleSelectedNovato(d.codigo)}
                        aria-selected={rowSelected}
                        className={cn(
                          'cursor-pointer transition-colors',
                          rowSelected
                            ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                            : cn('hover:bg-gray-50 dark:hover:bg-gray-800/40', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30'),
                        )}
                      >
                        <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{d.nome}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-center">
                            <span
                              className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400"
                            >
                              Primeiro mês
                            </span>
                          </div>
                        </td>
                        {d.weeks.map((w, i) => (
                          <td
                            key={i}
                            className={cn(
                              'px-4 py-2.5 text-right text-xs tabular-nums',
                              i === bestIdx && bestValue > 0
                                ? 'font-semibold text-amber-700 dark:text-amber-400'
                                : 'text-gray-700 dark:text-gray-300'
                            )}
                          >
                            {w.current > 0 ? formatLiters(w.current) : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {formatLiters(d.totalAtual)}
                        </td>
                        <td className="px-4 py-2.5">
                          {bestValue > 0 ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
                                <Star className="h-3 w-3" />
                                Pico Sem {bestIdx + 1} · {formatLiters(bestValue)}
                              </span>
                              {growing ? (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-400">
                                  <ArrowUp className="h-3 w-3" />
                                  Em crescimento
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {weeksActive}/4 semanas ativas
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mensagem de reconhecimento */}
      {exceptionals.length > 0 && (
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac' }}
        >
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#166534' }} />
            <p className="text-sm leading-relaxed" style={{ color: '#166534' }}>
              <span className="font-semibold">
                {exceptionals.map((e) => e.nome).slice(0, -1).join(', ')}
                {exceptionals.length > 1 ? ' e ' : ''}
                {exceptionals[exceptionals.length - 1].nome}
              </span>{' '}
              {exceptionals.length === 1 ? 'manteve' : 'mantiveram'} performance acima da meta em todas as semanas — {' '}
              {exceptionals.length === 1 ? 'é o profissional excepcional' : 'são os profissionais excepcionais'} de {currentMonthName} {currentYear}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Destaques
