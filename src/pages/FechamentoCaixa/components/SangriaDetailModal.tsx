import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { fmt } from './formatters'

export interface SangriaLancamento {
  hora: string
  forma: string
  pct: number // fração do total do funcionário
  obs?: string
}

interface SangriaDetailModalProps {
  open: boolean
  onClose: () => void
  funcionario: string | null
  total: number
  lancamentos: SangriaLancamento[]
}

const SangriaDetailModal = ({ open, onClose, funcionario, total, lancamentos }: SangriaDetailModalProps) => {
  const linhas = useMemo(
    () => lancamentos.map((l) => ({ ...l, valor: l.pct * total })),
    [lancamentos, total],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{funcionario ?? ''}</DialogTitle>
          <DialogDescription>
            {linhas.length} {linhas.length === 1 ? 'lançamento' : 'lançamentos'} · Total R$ {fmt(total)}
          </DialogDescription>
        </DialogHeader>

        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Sem lançamentos.</p>
        ) : (
          <div className="-mx-6 flex-1 overflow-auto px-6">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-4 py-2 text-left">Hora</th>
                  <th className="px-4 py-2 text-left">Forma</th>
                  <th className="px-4 py-2 text-right">Valor (R$)</th>
                  <th className="px-4 py-2 text-left">Observação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr
                    key={`${l.hora}-${i}`}
                    className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                  >
                    <td className="px-4 py-2 text-left tabular-nums">
                      <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {l.hora}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-left">
                      <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {l.forma}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{fmt(l.valor)}</td>
                    <td className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                      {l.obs ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0">
                <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td colSpan={2} className="px-4 py-2 text-left">Total:</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default SangriaDetailModal
