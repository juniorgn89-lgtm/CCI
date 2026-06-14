import { useMemo, useState } from 'react'
import { Target, Trophy, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import { useMetasStore } from '@/store/metas'
import { type FrentistaScore } from '@/lib/frentistaScore'
import BarCell from '@/components/tables/BarCell'
import FrentistaDetalheModal from '@/pages/Operacao/components/produtividade/FrentistaDetalheModal'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import type { AbastecimentoRow as AbastecimentoComCusto } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
  /** Abastecimentos crus do período — pro modal de detalhe por produto. */
  abastecimentos: AbastecimentoRow[]
  /** Linhas com custo/lucro (analytics) — alimentam o Lucro bruto por dia. */
  abastComCusto?: AbastecimentoComCusto[]
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

type PrimarySort = 'abastecimentos' | 'litros' | 'faturamento' | 'lucro'

const PRIMARY_OPTIONS: { key: PrimarySort; label: string }[] = [
  { key: 'abastecimentos', label: 'Abastec.' },
  { key: 'litros', label: 'Litros' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'lucro', label: 'Lucro bruto' },
]

const PRIMARY_TO_SORT_KEY: Record<PrimarySort, SortKey> = {
  abastecimentos: 'abastecimentos',
  litros: 'litros',
  faturamento: 'faturamento',
  lucro: 'lucroBruto',
}

const computeMeta = (
  f: FrentistaProdRow,
  manualMode: boolean,
  manualMetas: Record<number, number>,
): number => (manualMode ? manualMetas[f.funcionarioCodigo] ?? 0 : f.prevLitros)

// ── Day-grouped helpers (tabela em seções por dia, igual ao webPosto) ──
const upper = (s: string) => (s ?? '').toUpperCase()
const isAutomotivo = (n: string): boolean => {
  const u = upper(n)
  return u.includes('GASOLINA') || u.includes('ETANOL') || u.includes('ALCOOL') || u.includes('ÁLCOOL') ||
    u.includes('DIESEL') || u.includes('S-10') || u.includes('S10') || u.includes('S500')
}
const isGasolina = (n: string) => upper(n).includes('GASOLINA')
const isAditivada = (n: string) => upper(n).includes('ADITIVADA')

/** 'yyyy-MM-dd' → 'dd/MM/yyyy'. */
const formatDia = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

interface DiaFrentistaRow {
  codigo: number
  nome: string
  litros: number
  automotivo: number
  mixAditivadaPct: number
  abastecimentos: number
  faturamento: number
  lucroBruto: number | null
  ticketMedio: number
  ticketMedioAutomotivo: number
}

const compareDiaRow = (a: DiaFrentistaRow, b: DiaFrentistaRow, key: SortKey, dir: SortDir): number => {
  let av: number | string = 0
  let bv: number | string = 0
  switch (key) {
    case 'nome': av = a.nome; bv = b.nome; break
    case 'litros': av = a.litros; bv = b.litros; break
    case 'automotivo': av = a.automotivo; bv = b.automotivo; break
    case 'mixAditivada': av = a.mixAditivadaPct; bv = b.mixAditivadaPct; break
    case 'abastecimentos': av = a.abastecimentos; bv = b.abastecimentos; break
    case 'faturamento': av = a.faturamento; bv = b.faturamento; break
    case 'lucroBruto': av = a.lucroBruto ?? -Infinity; bv = b.lucroBruto ?? -Infinity; break
    case 'ticketMedio': av = a.ticketMedio; bv = b.ticketMedio; break
    case 'ticketMedioAutomotivo': av = a.ticketMedioAutomotivo; bv = b.ticketMedioAutomotivo; break
    default: av = a.abastecimentos; bv = b.abastecimentos
  }
  if (typeof av === 'string' && typeof bv === 'string') {
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  }
  return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
}

const VisaoGeral = ({ frentistas, periodInfo, abastecimentos, abastComCusto, scores }: Props) => {
  const { manualMode, metas: manualMetas } = useMetasStore()
  const [primarySort, setPrimarySort] = useState<PrimarySort>('abastecimentos')
  const [sortKey, setSortKey] = useState<SortKey>('abastecimentos')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Frentista aberto no modal de detalhe por produto.
  const [modalFrentista, setModalFrentista] = useState<{ codigo: number; nome: string } | null>(null)

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

  // Linhas por (dia × frentista), agrupadas em seções por dia (igual ao
  // relatório de Abastecimento do webPosto). Base (litros/fat/abast/automotivo/
  // mix/tickets) vem das linhas da operação; o Lucro bruto vem do analytics
  // (que tem custo) — "—" enquanto o custo carrega. Agrupa pela data do
  // abastecimento (dataHora), como o webPosto faz na exibição.
  const dias = useMemo(() => {
    const lucroHasData = (abastComCusto?.length ?? 0) > 0
    const lucroMap = new Map<string, number>()
    for (const r of abastComCusto ?? []) {
      if (r.precoCusto <= 0) continue
      const key = `${(r.dataHora || '').slice(0, 10)}|${r.frentistaCodigo}`
      lucroMap.set(key, (lucroMap.get(key) ?? 0) + r.lucroBruto)
    }

    interface Acc {
      codigo: number; nome: string
      litros: number; automotivo: number; gasolina: number; aditivada: number
      abast: number; fat: number; fatAuto: number; abastAuto: number
    }
    const perDay = new Map<string, Map<number, Acc>>()
    for (const a of abastecimentos) {
      const dia = (a.dataHora || '').slice(0, 10)
      if (dia.length !== 10) continue
      const m = perDay.get(dia) ?? new Map<number, Acc>()
      const acc = m.get(a.frentistaCodigo) ?? {
        codigo: a.frentistaCodigo, nome: a.frentistaNome,
        litros: 0, automotivo: 0, gasolina: 0, aditivada: 0, abast: 0, fat: 0, fatAuto: 0, abastAuto: 0,
      }
      const auto = isAutomotivo(a.produtoNome)
      acc.litros += a.litros
      acc.abast += 1
      acc.fat += a.valorTotal
      if (auto) { acc.automotivo += a.litros; acc.fatAuto += a.valorTotal; acc.abastAuto += 1 }
      if (isGasolina(a.produtoNome)) { acc.gasolina += a.litros; if (isAditivada(a.produtoNome)) acc.aditivada += a.litros }
      m.set(a.frentistaCodigo, acc)
      perDay.set(dia, m)
    }

    return Array.from(perDay.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dia, m]) => {
        const accs = Array.from(m.values())
        const linhas: DiaFrentistaRow[] = accs.map((acc) => ({
          codigo: acc.codigo,
          nome: acc.nome,
          litros: acc.litros,
          automotivo: acc.automotivo,
          mixAditivadaPct: acc.gasolina > 0 ? (acc.aditivada / acc.gasolina) * 100 : 0,
          abastecimentos: acc.abast,
          faturamento: acc.fat,
          lucroBruto: lucroHasData ? (lucroMap.get(`${dia}|${acc.codigo}`) ?? 0) : null,
          ticketMedio: acc.abast > 0 ? acc.fat / acc.abast : 0,
          ticketMedioAutomotivo: acc.abastAuto > 0 ? acc.fatAuto / acc.abastAuto : 0,
        }))
        linhas.sort((a, b) => compareDiaRow(a, b, sortKey, sortDir))

        const totGas = accs.reduce((s, a) => s + a.gasolina, 0)
        const totAdit = accs.reduce((s, a) => s + a.aditivada, 0)
        const totFatAuto = accs.reduce((s, a) => s + a.fatAuto, 0)
        const totAbastAuto = accs.reduce((s, a) => s + a.abastAuto, 0)
        const totAbast = linhas.reduce((s, l) => s + l.abastecimentos, 0)
        const totFat = linhas.reduce((s, l) => s + l.faturamento, 0)
        const subtotal: DiaFrentistaRow = {
          codigo: -1,
          nome: `Subtotal ${formatDia(dia)}`,
          litros: linhas.reduce((s, l) => s + l.litros, 0),
          automotivo: linhas.reduce((s, l) => s + l.automotivo, 0),
          mixAditivadaPct: totGas > 0 ? (totAdit / totGas) * 100 : 0,
          abastecimentos: totAbast,
          faturamento: totFat,
          lucroBruto: lucroHasData ? linhas.reduce((s, l) => s + (l.lucroBruto ?? 0), 0) : null,
          ticketMedio: totAbast > 0 ? totFat / totAbast : 0,
          ticketMedioAutomotivo: totAbastAuto > 0 ? totFatAuto / totAbastAuto : 0,
        }
        return { dia, linhas, subtotal }
      })
  }, [abastecimentos, abastComCusto, sortKey, sortDir])

  // Máximos por coluna pra escala das barras (data bars) — sobre todas as linhas.
  const colMax = useMemo(() => {
    const all = dias.flatMap((d) => d.linhas)
    return {
      litros: Math.max(...all.map((f) => f.litros), 0),
      automotivo: Math.max(...all.map((f) => f.automotivo), 0),
      abastecimentos: Math.max(...all.map((f) => f.abastecimentos), 0),
      faturamento: Math.max(...all.map((f) => f.faturamento), 0),
      lucroBruto: Math.max(...all.map((f) => f.lucroBruto ?? 0), 0),
      ticketMedio: Math.max(...all.map((f) => f.ticketMedio), 0),
      ticketAut: Math.max(...all.map((f) => f.ticketMedioAutomotivo), 0),
    }
  }, [dias])

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
              {/* "?" — clique numa linha abre o detalhe por produto do frentista */}
              <span className="group/help relative inline-flex cursor-help" tabIndex={0} aria-label="Como usar">
                <HelpCircle className="h-3.5 w-3.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200" />
                <span className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 rounded-md bg-gray-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover/help:opacity-100 group-focus/help:opacity-100 dark:bg-gray-800">
                  Clique num frentista pra ver o detalhe por produto (litros, preço médio, faturamento e nº de abastecimentos).
                </span>
              </span>
            </div>
            <p className="mt-0.5 text-xs italic text-gray-400">
              Comparação de desempenho entre frentistas · clique pra detalhar por produto
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
                <th colSpan={2} className="bg-gray-100/60 px-4 py-1.5 dark:bg-gray-800/60" />
                <GroupTh first label="Operação" colSpan={4} />
                <GroupTh label="Financeiro" colSpan={2} />
                <GroupTh label="Eficiência" colSpan={2} />
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <Th className="w-10">#</Th>
                <ThSort label="Frentista" k="nome" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('nome')} align="left" />
                <ThSort label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('litros')} />
                <ThSort label="Automotivo" k="automotivo" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('automotivo')} />
                <ThSort label="Mix aditiv." k="mixAditivada" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('mixAditivada')} />
                <ThSort label="Abastec." k="abastecimentos" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('abastecimentos')} />
                <ThSort label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('faturamento')} groupStart />
                <ThSort label="Lucro bruto" k="lucroBruto" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('lucroBruto')} />
                <ThSort label="Ticket méd." k="ticketMedio" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('ticketMedio')} groupStart />
                <ThSort label="Ticket aut." k="ticketMedioAutomotivo" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('ticketMedioAutomotivo')} />
              </tr>
            </thead>
            {dias.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-gray-400">
                    Sem dados de frentistas no período.
                  </td>
                </tr>
              </tbody>
            ) : (
              dias.map((d) => (
                <tbody key={d.dia} className="divide-y divide-gray-100 dark:divide-gray-800">
                  {/* Cabeçalho de dia (igual ao bloco de data do webPosto) */}
                  <tr className="bg-gray-100/70 dark:bg-gray-800/60">
                    <td colSpan={10} className="px-4 py-1.5 text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                      {formatDia(d.dia)}
                    </td>
                  </tr>
                  {d.linhas.map((f, idx) => (
                    <tr
                      key={`${d.dia}-${f.codigo}`}
                      onClick={() => setModalFrentista({ codigo: f.codigo, nome: f.nome })}
                      title="Ver detalhe por produto"
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40',
                        idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30',
                      )}
                    >
                      <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{f.nome}</td>
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
                        <BarCell value={f.ticketMedio} max={colMax.ticketMedio} formatted={formatCurrency(f.ticketMedio)} color="amber" align="near" />
                      </td>
                      <td className="px-2 py-2.5">
                        {f.ticketMedioAutomotivo > 0
                          ? <BarCell value={f.ticketMedioAutomotivo} max={colMax.ticketAut} formatted={formatCurrency(f.ticketMedioAutomotivo)} color="amber" align="near" />
                          : <div className="text-right text-sm text-gray-400">—</div>}
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal do dia — só quando há mais de um frentista no dia. */}
                  {d.linhas.length > 1 && (
                    <tr className="bg-gray-50/80 text-xs font-semibold text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2">{d.subtotal.nome}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatLiters(d.subtotal.litros)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatLiters(d.subtotal.automotivo)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.subtotal.mixAditivadaPct > 0 ? `${d.subtotal.mixAditivadaPct.toFixed(0)}%` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatNumber(d.subtotal.abastecimentos)}</td>
                      <td className="border-l border-gray-200 px-4 py-2 text-right tabular-nums dark:border-gray-700">{formatCurrency(d.subtotal.faturamento)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.subtotal.lucroBruto === null ? '—' : formatCurrency(d.subtotal.lucroBruto)}</td>
                      <td className="border-l border-gray-200 px-4 py-2 text-right tabular-nums dark:border-gray-700">{formatCurrency(d.subtotal.ticketMedio)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.subtotal.ticketMedioAutomotivo > 0 ? formatCurrency(d.subtotal.ticketMedioAutomotivo) : '—'}</td>
                    </tr>
                  )}
                </tbody>
              ))
            )}
          </table>
        </div>
      </div>

      <FrentistaDetalheModal
        open={modalFrentista !== null}
        onClose={() => setModalFrentista(null)}
        nome={modalFrentista?.nome ?? ''}
        codigo={modalFrentista?.codigo ?? -1}
        abastecimentos={abastecimentos}
      />
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
