import { useMemo } from 'react'
import { TriangleAlert } from 'lucide-react'
import { formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import type { ReceivableRow, PayableRow, DuplicataRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  receivables: ReceivableRow[]
  payables: PayableRow[]
  duplicatas: DuplicataRow[]
}

const JANELAS = [7, 15, 30] as const

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * Próximos vencimentos — soma o saldo A VENCER (a receber × a pagar) em janelas
 * cumulativas de 7/15/30 dias a partir de hoje. Alerta quando, na janela de 7
 * dias, o que vai pagar supera o que vai receber (risco de caixa).
 */
const ProximosVencimentos = ({ receivables, payables, duplicatas }: Props) => {
  const linhas = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    return JANELAS.map((dias) => {
      const limite = addDays(hoje, dias)
      let receber = 0
      let pagar = 0
      for (const r of receivables) {
        if (r.statusTag !== 'a-vencer') continue
        const v = (r.dataVencimento ?? '').split('T')[0]
        if (v >= hoje && v <= limite) receber += r.valor
      }
      for (const d of duplicatas) {
        if (d.statusTag !== 'a-vencer') continue
        const v = (d.vencimento ?? '').split('T')[0]
        if (v >= hoje && v <= limite) receber += d.saldoRestante
      }
      for (const p of payables) {
        if (p.statusTag !== 'a-vencer') continue
        const v = (p.vencimento ?? '').split('T')[0]
        if (v >= hoje && v <= limite) pagar += p.saldoRestante
      }
      return { dias, receber, pagar }
    })
  }, [receivables, payables, duplicatas])

  const j7 = linhas[0]
  const alerta = j7 && j7.pagar - j7.receber > 0.005 ? j7.pagar - j7.receber : 0

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-1.5">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Próximos vencimentos</h3>
        <InfoHint text="Saldo a vencer somado por janela (próximos 7/15/30 dias), comparando o que entra (receber) com o que sai (pagar)." align="start" />
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">A receber × a pagar nos próximos dias</p>

      <div className="mt-4 space-y-3">
        {linhas.map((l) => (
          <div key={l.dias} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{l.dias} dias</span>
            <div className="flex items-center gap-2 text-sm tabular-nums">
              <span className="font-semibold text-[#047857] dark:text-emerald-400">+{formatCurrencyInt(l.receber)}</span>
              <span className="text-gray-300 dark:text-gray-600">/</span>
              <span className="font-semibold text-[#b91c1c] dark:text-red-400">−{formatCurrencyInt(l.pagar)}</span>
            </div>
          </div>
        ))}
      </div>

      {alerta > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706] dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-[#b45309] dark:text-amber-300">
            Em <strong>7 dias</strong>, paga {formatCurrencyInt(alerta)} a mais do que recebe — atenção ao caixa.
          </p>
        </div>
      )}
    </div>
  )
}

export default ProximosVencimentos
