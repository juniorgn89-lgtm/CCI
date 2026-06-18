import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters } from '@/lib/formatters'
import { useMetasStore } from '@/store/metas'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
}

type StatusFilter = 'todos' | 'atingida' | 'parcial' | 'abaixo' | 'sem'

const STATUS_OPTIONS: { v: StatusFilter; l: string }[] = [
  { v: 'todos', l: 'Todos' },
  { v: 'atingida', l: 'Atingida' },
  { v: 'parcial', l: 'Parcial' },
  { v: 'abaixo', l: 'Abaixo' },
  { v: 'sem', l: 'Sem meta' },
]

const lastDayOfMonth = (year: number, month: number): number => new Date(year, month, 0).getDate()

/** Fator de projeção pró-rata pelo mês corrente (mês fechado → 1). */
const proRataFactor = (periodInfo: PeriodInfo): number => {
  const [y, m] = (periodInfo.dataInicial ?? '').split('-').map(Number)
  if (!y || !m) return 1
  const daysInMonth = lastDayOfMonth(y, m)
  const [ty, tm, td] = (periodInfo.todayStr ?? '').split('-').map(Number)
  const isCurrentMonth = ty === y && tm === m
  const elapsed = isCurrentMonth ? Math.min(td, daysInMonth) : daysInMonth
  return elapsed > 0 ? daysInMonth / elapsed : 1
}

const getStatus = (meta: number, pct: number): StatusFilter => {
  if (meta <= 0) return 'sem'
  if (pct >= 100) return 'atingida'
  if (pct >= 70) return 'parcial'
  return 'abaixo'
}

/**
 * Metas manuais por colaborador (litros), persistidas em localStorage via
 * useMetasStore (`visor360-metas`). Mostra Realizado, Projetado (pró-rata pelo
 * mês) e % atingido = realizado ÷ meta. Sem API de escrita — leitura + storage.
 */
const Metas = ({ frentistas, periodInfo }: Props) => {
  const { metas, setMeta, resetMetas } = useMetasStore()
  const factor = useMemo(() => proRataFactor(periodInfo), [periodInfo])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')

  const rows = useMemo(() => {
    return frentistas.map((f) => {
      const meta = metas[f.funcionarioCodigo] ?? 0
      const realizado = f.litros
      const projetado = realizado * factor
      const pct = meta > 0 ? (realizado / meta) * 100 : 0
      return { ...f, meta, realizado, projetado, pct }
    })
  }, [frentistas, metas, factor])

  const filtered = useMemo(
    () => rows.filter((r) => statusFilter === 'todos' || getStatus(r.meta, r.pct) === statusFilter),
    [rows, statusFilter],
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Metas manuais por frentista</h3>
            <p className="mt-0.5 text-xs italic text-gray-400">
              Defina a meta de litros por colaborador · salva automaticamente neste navegador
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setStatusFilter(opt.v)}
                  className={cn(
                    'rounded-lg px-3 py-1 text-[13px] font-medium transition-colors',
                    statusFilter === opt.v
                      ? 'bg-[#1e3a5f] text-white shadow-sm'
                      : 'bg-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100',
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <button
              onClick={resetMetas}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar metas
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Meta (litros)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Realizado</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Projetado (mês)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">% Atingido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {frentistas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">Sem frentistas no período.</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                    Nenhum frentista com status "{STATUS_OPTIONS.find((o) => o.v === statusFilter)?.l}".
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.funcionarioCodigo} className={idx % 2 === 1 ? 'bg-gray-50/70 dark:bg-gray-800/30' : undefined}>
                    <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{r.nome}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={r.meta > 0 ? r.meta : ''}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setMeta(r.funcionarioCodigo, isFinite(v) && v >= 0 ? v : 0)
                        }}
                        placeholder="Ex: 45000"
                        className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1 text-right text-sm tabular-nums text-gray-900 placeholder:text-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-600"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                      {formatLiters(r.realizado)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-blue-600 dark:text-blue-400">
                      {formatLiters(r.projetado)}
                    </td>
                    <td className={cn(
                      'px-4 py-2.5 text-right text-sm font-medium tabular-nums',
                      r.meta <= 0 ? 'text-gray-400'
                        : r.pct >= 100 ? 'text-green-600 dark:text-green-400'
                        : r.pct >= 70 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400',
                    )}>
                      {r.meta <= 0 ? '—' : `${r.pct.toFixed(2).replace('.', ',')}%`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Metas
