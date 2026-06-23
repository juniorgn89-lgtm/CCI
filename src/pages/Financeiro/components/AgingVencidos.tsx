import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import type { ReceivableRow, PayableRow, DuplicataRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  receivables: ReceivableRow[]
  payables: PayableRow[]
  duplicatas: DuplicataRow[]
}

/** Faixas de idade do vencido. */
const BUCKETS = [
  { label: '1–30 dias', short: '1–30', color: '#f59e0b' },
  { label: '31–60 dias', short: '31–60', color: '#ea580c' },
  { label: '60 dias+', short: '60d+', color: '#dc2626' },
] as const

const bucketIdx = (dias: number): number => (dias <= 30 ? 0 : dias <= 60 ? 1 : 2)

const AgingRow = ({ label, total, buckets }: { label: string; total: number; buckets: number[] }) => (
  <div>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(total)}</span>
    </div>
    <div className="mt-1.5 flex h-3 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
      {buckets.map((v, i) => {
        const w = total > 0 ? (v / total) * 100 : 0
        return w > 0 ? <div key={i} style={{ width: `${w}%`, backgroundColor: BUCKETS[i].color }} /> : null
      })}
    </div>
    <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
      {buckets.map((v, i) => (
        <span key={i} className={cn(i === 0 && 'text-left', i === 1 && 'text-center', i === 2 && 'text-right')}>
          {formatCurrencyInt(v)}
        </span>
      ))}
    </div>
  </div>
)

/**
 * Aging de vencidos — distribui o saldo VENCIDO (a receber × a pagar) por faixa
 * de dias de atraso (1–30 / 31–60 / 60d+), a partir do `diasAtraso` já calculado
 * no `useFinanceData`. A receber inclui títulos a receber + duplicatas em aberto.
 */
const AgingVencidos = ({ receivables, payables, duplicatas }: Props) => {
  const { receber, pagar } = useMemo(() => {
    const receber = [0, 0, 0]
    const pagar = [0, 0, 0]
    for (const r of receivables) if (r.statusTag === 'vencido') receber[bucketIdx(r.diasAtraso)] += r.valor
    for (const d of duplicatas) if (d.statusTag === 'vencido') receber[bucketIdx(d.diasAtraso)] += d.saldoRestante
    for (const p of payables) if (p.statusTag === 'vencido') pagar[bucketIdx(p.diasAtraso)] += p.saldoRestante
    return { receber, pagar }
  }, [receivables, payables, duplicatas])

  const totalReceber = receber.reduce((s, v) => s + v, 0)
  const totalPagar = pagar.reduce((s, v) => s + v, 0)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Aging de vencidos</h3>
            <InfoHint text="Distribui o saldo vencido por idade do atraso (dias desde o vencimento)." align="start" />
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Há quanto tempo os títulos estão vencidos</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {BUCKETS.map((b) => (
            <span key={b.short} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} /> {b.short}
            </span>
          ))}
        </div>
      </div>

      {totalReceber === 0 && totalPagar === 0 ? (
        <p className="mt-6 text-sm text-gray-400 dark:text-gray-500">Nenhum título vencido no escopo. 🎉</p>
      ) : (
        <div className="mt-5 space-y-5">
          <AgingRow label="A receber vencido" total={totalReceber} buckets={receber} />
          <AgingRow label="A pagar vencido" total={totalPagar} buckets={pagar} />
        </div>
      )}
    </div>
  )
}

export default AgingVencidos
