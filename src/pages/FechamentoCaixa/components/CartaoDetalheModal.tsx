import { CreditCard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { fmt } from './formatters'

interface CartaoDetalheModalProps {
  open: boolean
  onClose: () => void
  /** Total da linha "Cartão" das Saídas — é dividido pelo mix abaixo. */
  total: number
}

/**
 * Mix mock por bandeira × tipo (proporções somam 100%). Quando a aba for ligada
 * a dados reais, trocar por /VENDA_FORMA_PAGAMENTO (administradora/nomeFormaPagamento)
 * + /VENDA aninhado (bandeira, tipoTransacao débito/crédito).
 */
const MIX: { bandeira: string; tipo: 'Crédito' | 'Débito'; pct: number }[] = [
  { bandeira: 'Visa', tipo: 'Crédito', pct: 0.28 },
  { bandeira: 'Mastercard', tipo: 'Crédito', pct: 0.24 },
  { bandeira: 'Visa', tipo: 'Débito', pct: 0.14 },
  { bandeira: 'Mastercard', tipo: 'Débito', pct: 0.12 },
  { bandeira: 'Elo', tipo: 'Crédito', pct: 0.09 },
  { bandeira: 'Elo', tipo: 'Débito', pct: 0.06 },
  { bandeira: 'American Express', tipo: 'Crédito', pct: 0.04 },
  { bandeira: 'Hipercard', tipo: 'Crédito', pct: 0.03 },
]

const CartaoDetalheModal = ({ open, onClose, total }: CartaoDetalheModalProps) => {
  const linhas = MIX.map((m) => ({ ...m, valor: total * m.pct })).sort((a, b) => b.valor - a.valor)
  const credito = linhas.filter((l) => l.tipo === 'Crédito').reduce((s, l) => s + l.valor, 0)
  const debito = linhas.filter((l) => l.tipo === 'Débito').reduce((s, l) => s + l.valor, 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-500" />
            Cartão · detalhamento por bandeira
          </DialogTitle>
          <DialogDescription>
            Total R$ {fmt(total)} · Crédito R$ {fmt(credito)} · Débito R$ {fmt(debito)}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 overflow-auto px-6">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-900">
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-2 text-left">Bandeira</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-right">Valor (R$)</th>
                <th className="px-4 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {linhas.map((l, i) => (
                <tr key={`${l.bandeira}-${l.tipo}-${i}`} className="text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-2 text-left font-medium">{l.bandeira}</td>
                  <td className="px-4 py-2 text-left">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                      {l.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmt(l.valor)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                    {(l.pct * 100).toFixed(1).replace('.', ',')}%
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <td className="px-4 py-2 text-left" colSpan={2}>Total:</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(total)}</td>
                <td className="px-4 py-2 text-right tabular-nums">100,0%</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
            Dados ilustrativos. Quando a aba for ligada ao /VENDA, a quebra vem por administradora/bandeira e débito/crédito reais.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CartaoDetalheModal
