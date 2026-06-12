import { CreditCard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import type { CartaoLinha } from '@/pages/FechamentoCaixa/hooks/useCartaoBreakdown'

interface CartaoDetalheModalProps {
  open: boolean
  onClose: () => void
  linhas: CartaoLinha[]
  total: number
  /** PDVs presentes (Pista / Conveniência / …). >1 → mostra colunas por PDV. */
  pdvs: string[]
  isLoading: boolean
}

const TipoBadge = ({ tipo }: { tipo: string }) => (
  <span className={cn(
    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
    tipo === 'Crédito'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : tipo === 'Débito'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  )}>
    {tipo}
  </span>
)

/** Detalhe do cartão por bandeira + débito/crédito + administradora (do /VENDA),
 *  com colunas por PDV (Pista × Conveniência) quando há mais de um selecionado. */
const CartaoDetalheModal = ({ open, onClose, linhas, total, pdvs, isLoading }: CartaoDetalheModalProps) => {
  const splitPdv = pdvs.length > 1
  const totalPorPdv = (pdv: string) => linhas.reduce((s, l) => s + (l.porPdv[pdv] ?? 0), 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className={cn('flex max-h-[88vh] flex-col overflow-hidden', splitPdv ? 'w-[96vw] max-w-3xl' : 'w-[95vw] max-w-2xl')}>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              Detalhe do Cartão
            </span>
          </DialogTitle>
          <DialogDescription>
            Quebra por bandeira e débito/crédito{splitPdv ? ' · separado por Pista × Conveniência' : ''} (base: vendas autorizadas do período)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-400">Carregando detalhe do cartão…</p>
          ) : linhas.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              Sem detalhe de cartão (bandeira/transação) nas vendas dos caixas selecionados.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Bandeira</th>
                  <th className="px-3 py-2 text-left font-medium">Tipo</th>
                  {splitPdv ? (
                    pdvs.map((p) => <th key={p} className="px-3 py-2 text-right font-medium">{p}</th>)
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left font-medium">Administradora</th>
                      <th className="px-3 py-2 text-right font-medium">Transações</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {linhas.map((l) => (
                  <tr key={l.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{l.bandeira}</td>
                    <td className="px-3 py-2"><TipoBadge tipo={l.tipo} /></td>
                    {splitPdv ? (
                      pdvs.map((p) => (
                        <td key={p} className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                          {l.porPdv[p] ? formatCurrency(l.porPdv[p]) : '—'}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{l.gestora || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(l.quantidade)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/50">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-200" colSpan={2}>Total cartão (vendido)</td>
                  {splitPdv ? (
                    pdvs.map((p) => (
                      <td key={p} className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalPorPdv(p))}</td>
                    ))
                  ) : (
                    <td colSpan={2} />
                  )}
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CartaoDetalheModal
