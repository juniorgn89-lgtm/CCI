import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export interface DrilldownDailyRow {
  data: string
  quantidade: number
  faturamento: number
  margem: number
}

export interface DrilldownPayload {
  nome: string
  unidade: 'L' | 'un'
  quantidade: number
  faturamento: number
  margem: number
  margemPct: number
  dailyRows: DrilldownDailyRow[]
}

interface ProdutoDrilldownModalProps {
  open: boolean
  onClose: () => void
  payload: DrilldownPayload | null
  accentClass?: string
}

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

const ProdutoDrilldownModal = ({ open, onClose, payload, accentClass = 'text-blue-600 dark:text-blue-400' }: ProdutoDrilldownModalProps) => {
  const totals = useMemo(() => {
    if (!payload) return null
    const qtd = payload.dailyRows.reduce((s, r) => s + r.quantidade, 0)
    const fat = payload.dailyRows.reduce((s, r) => s + r.faturamento, 0)
    const mar = payload.dailyRows.reduce((s, r) => s + r.margem, 0)
    return { qtd, fat, mar }
  }, [payload])

  if (!payload) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className={accentClass}>{payload.nome}</DialogTitle>
          <DialogDescription>
            Evolução diária no período selecionado
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniKpi label={payload.unidade === 'L' ? 'Litros' : 'Quantidade'} value={formatNumber(payload.quantidade)} />
          <MiniKpi label="Faturamento" value={formatCurrencyInt(payload.faturamento)} />
          <MiniKpi label="Margem (R$)" value={formatCurrencyInt(payload.margem)} valueClass={payload.margem < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'} />
          <MiniKpi label="Margem (%)" value={fmtPct(payload.margemPct)} />
        </div>

        <div className="-mx-6 flex-1 overflow-auto px-6">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-900">
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Faturamento</th>
                <th className="px-3 py-2 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {payload.dailyRows.map((row) => (
                <tr key={row.data} className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200">
                  <td className="px-3 py-1.5 text-left tabular-nums">{row.data.split('-').reverse().join('/')}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(row.quantidade)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.faturamento)}</td>
                  <td className={cn('px-3 py-1.5 text-right tabular-nums', row.margem < 0 && 'text-red-700 dark:text-red-400')}>
                    {formatCurrency(row.margem)}
                  </td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot className="sticky bottom-0">
                <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-3 py-2 text-left">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.qtd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(totals.fat)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', totals.mar < 0 && 'text-red-600 dark:text-red-400')}>
                    {formatCurrencyInt(totals.mar)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface MiniKpiProps {
  label: string
  value: string
  valueClass?: string
}

const MiniKpi = ({ label, value, valueClass }: MiniKpiProps) => (
  <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
    <p className={cn('mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100', valueClass)}>
      {value}
    </p>
  </div>
)

export default ProdutoDrilldownModal
