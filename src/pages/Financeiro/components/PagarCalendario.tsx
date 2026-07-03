import { useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { mondayOf, weekChipLabel } from '@/lib/weekGroups'
import BarCell from '@/components/tables/BarCell'
import PagarDiaModal from '@/pages/Financeiro/components/PagarDiaModal'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'

/**
 * Calendário de pagamento — o que a rede TEM A PAGAR, por dia de vencimento.
 * 1 linha por dia da semana ativa que tenha desembolso, com navegação de semana.
 * Dias no passado com título em aberto = vencido; no futuro = a vencer. Só dado
 * real do /TITULO_PAGAR (saldo restante). Fecho com Semana + Total em aberto.
 */

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const todayISO = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const addDaysISO = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const diaNome = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS_SEMANA[new Date(y, m - 1, d).getDay()]
}
const isAberto = (r: PayableRow) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer'

interface DiaAgg { valor: number; titulos: number; fornecedores: Set<number>; rows: PayableRow[] }

const PagarCalendario = ({ data }: { data: PayableRow[] }) => {
  const hoje = todayISO()

  // Agrega os títulos em aberto por dia de vencimento.
  const porDia = useMemo(() => {
    const map = new Map<string, DiaAgg>()
    for (const r of data) {
      if (!isAberto(r)) continue
      const d = onlyDate(r.vencimento)
      if (!d) continue
      const g = map.get(d) ?? { valor: 0, titulos: 0, fornecedores: new Set<number>(), rows: [] }
      g.valor += r.saldoRestante
      g.titulos += 1
      g.fornecedores.add(r.fornecedorCodigo)
      g.rows.push(r)
      map.set(d, g)
    }
    return map
  }, [data])

  const totalAberto = useMemo(() => data.reduce((s, r) => (isAberto(r) ? s + r.saldoRestante : s), 0), [data])

  // Só as semanas que TÊM título a pagar (+ a de hoje) — sem semanas vazias.
  const weeks = useMemo(() => {
    const mondays = new Set<string>()
    for (const d of porDia.keys()) mondays.add(mondayOf(d))
    mondays.add(mondayOf(hoje))
    return [...mondays].sort().map((monday) => ({ monday, min: monday, max: addDaysISO(monday, 6) }))
  }, [porDia, hoje])

  const [activeMonday, setActiveMonday] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<{ dia: string; rows: PayableRow[] } | null>(null)
  const activeIdx = useMemo(() => {
    if (activeMonday) {
      const i = weeks.findIndex((w) => w.monday === activeMonday)
      if (i >= 0) return i
    }
    const iHoje = weeks.findIndex((w) => w.monday === mondayOf(hoje))
    return iHoje >= 0 ? iHoje : weeks.length - 1
  }, [weeks, activeMonday, hoje])
  const semanaAtiva = weeks[activeIdx]

  // Só os dias da semana ativa que TÊM desembolso (seg→dom), sem linhas vazias.
  const dias = useMemo(() => {
    if (!semanaAtiva) return []
    return Array.from({ length: 7 }, (_, i) => {
      const data = addDaysISO(semanaAtiva.monday, i)
      const g = porDia.get(data)
      return {
        data,
        valor: g?.valor ?? 0,
        titulos: g?.titulos ?? 0,
        fornecedores: g?.fornecedores.size ?? 0,
        rows: g?.rows ?? [],
        vencido: !!g && data < hoje,
      }
    }).filter((d) => d.titulos > 0)
  }, [semanaAtiva, porDia, hoje])

  const maxValor = useMemo(() => Math.max(...dias.map((d) => d.valor), 0), [dias])
  const semana = useMemo(() => ({
    valor: dias.reduce((s, d) => s + d.valor, 0),
    titulos: dias.reduce((s, d) => s + d.titulos, 0),
  }), [dias])

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <CalendarRange className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Calendário de pagamento</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">A pagar por dia de vencimento — clique num dia para ver os títulos</p>
        </div>
      </div>

      {/* Stepper de semana — ‹ [intervalo] › + atalho "Hoje" (sem paredão de abas). */}
      <div className="flex items-center justify-center gap-3 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <button
          type="button"
          aria-label="Semana anterior"
          disabled={activeIdx <= 0}
          onClick={() => setActiveMonday(weeks[Math.max(activeIdx - 1, 0)].monday)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:opacity-30 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-[150px] text-center">
          <span className="inline-block rounded-md bg-[#1e3a5f] px-3 py-1 text-sm font-semibold tabular-nums text-white dark:bg-blue-700">
            {semanaAtiva ? weekChipLabel(semanaAtiva.min, semanaAtiva.max) : '—'}
          </span>
          <p className="mt-0.5 text-[10px] text-gray-400">semana {activeIdx + 1} de {weeks.length}</p>
        </div>
        <button
          type="button"
          aria-label="Próxima semana"
          disabled={activeIdx >= weeks.length - 1}
          onClick={() => setActiveMonday(weeks[Math.min(activeIdx + 1, weeks.length - 1)].monday)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:opacity-30 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {semanaAtiva?.monday !== mondayOf(hoje) && (
          <button
            type="button"
            onClick={() => setActiveMonday(mondayOf(hoje))}
            className="ml-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Hoje
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[10px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <th className="px-4 py-2 font-medium">Data</th>
              <th className="px-4 py-2 font-medium">Dia da semana</th>
              <th className="px-4 py-2 text-right font-medium">Títulos</th>
              <th className="px-4 py-2 text-right font-medium">Fornecedores</th>
              <th className="px-2 py-2 font-medium">A pagar</th>
              <th className="px-4 py-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {dias.length === 0 && (
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-gray-400 dark:text-gray-500">
                  Nenhum vencimento nesta semana
                </td>
              </tr>
            )}
            {dias.map((d) => {
              const isHoje = d.data === hoje
              return (
                <tr
                  key={d.data}
                  onClick={() => setDetalhe({ dia: d.data, rows: d.rows })}
                  className={cn(
                    'cursor-pointer border-b border-gray-100 text-gray-700 transition-colors hover:bg-red-50/50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-red-950/20',
                    isHoje && 'bg-blue-50/40 dark:bg-blue-950/20',
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums text-gray-900 dark:text-gray-100">
                    {brDate(d.data)}
                    {isHoje && <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">hoje</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{diaNome(d.data)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(d.titulos)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(d.fornecedores)}</td>
                  <td className="px-2 py-1.5">
                    <BarCell value={d.valor} max={maxValor} formatted={formatCurrencyInt(d.valor)} color={d.vencido ? 'red' : 'blue'} align="near" />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {d.vencido
                      ? <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">Vencido</span>
                      : <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400">A vencer</span>}
                  </td>
                </tr>
              )
            })}
            {/* Fecho: subtotal da semana + total a pagar */}
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold dark:border-gray-600 dark:bg-gray-800/60">
              <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                Semana <span className="ml-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{semanaAtiva ? weekChipLabel(semanaAtiva.min, semanaAtiva.max) : ''}</span>
              </td>
              <td />
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(semana.titulos)}</td>
              <td />
              <td className="px-4 py-2.5 tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(semana.valor)}</td>
              <td />
            </tr>
            <tr className="bg-gray-50/60 text-[12px] text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
              <td className="px-4 py-2" colSpan={4}>Total a pagar em aberto (todos os vencimentos)</td>
              <td className="px-4 py-2 tabular-nums font-semibold text-gray-700 dark:text-gray-300">{formatCurrencyInt(totalAberto)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <PagarDiaModal
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        dia={detalhe?.dia ?? ''}
        titulos={detalhe?.rows ?? []}
      />
    </section>
  )
}

export default PagarCalendario
