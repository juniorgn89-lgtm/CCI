import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import BarCell from '@/components/tables/BarCell'
import { cn } from '@/lib/utils'
import { fmt } from './formatters'

export interface GrupoProduto {
  nome: string
  quantidade: number
  total: number
  margemBruta: number
}

interface GrupoProdutosModalProps {
  open: boolean
  onClose: () => void
  grupo: string | null
  produtos: GrupoProduto[]
}

const GrupoProdutosModal = ({ open, onClose, grupo, produtos }: GrupoProdutosModalProps) => {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open) setSearch('')
  }, [open, grupo])

  const filtered = useMemo(() => {
    if (!search) return produtos
    const q = search.toLowerCase()
    return produtos.filter((p) => p.nome.toLowerCase().includes(q))
  }, [produtos, search])

  const totals = useMemo(() => {
    const quantidade = filtered.reduce((s, p) => s + p.quantidade, 0)
    const total = filtered.reduce((s, p) => s + p.total, 0)
    const margem = filtered.reduce((s, p) => s + p.margemBruta, 0)
    const margemPct = total > 0 ? (margem / total) * 100 : 0
    return { quantidade, total, margem, margemPct, itens: filtered.length }
  }, [filtered])

  const maxTotal = filtered.reduce((m, p) => Math.max(m, p.total), 0)
  const maxMargemAbs = filtered.reduce((m, p) => Math.max(m, Math.abs(p.margemBruta)), 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{grupo ?? ''}</DialogTitle>
          <DialogDescription>
            {totals.itens} produto{totals.itens === 1 ? '' : 's'} · R$ {fmt(totals.total)} · margem {totals.margemPct.toFixed(1)}%
          </DialogDescription>
        </DialogHeader>

        {produtos.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Sem produtos nesse grupo.</p>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>

            <div className="-mx-6 flex-1 overflow-auto px-6">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-gray-900">
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    <th className="px-4 py-2 text-left">Produto</th>
                    <th className="px-4 py-2 text-right">Qtd</th>
                    <th className="px-4 py-2 text-right">Total (R$)</th>
                    <th className="px-4 py-2 text-right">Margem (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.nome}
                      className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                    >
                      <td className="px-4 py-2 text-left">{p.nome}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(p.quantidade)}</td>
                      <td className="px-2 py-1.5">
                        <BarCell value={p.total} max={maxTotal} formatted={fmt(p.total)} color="blue" align="near" />
                      </td>
                      <td className="px-2 py-1.5">
                        <BarCell
                          value={Math.abs(p.margemBruta)}
                          max={maxMargemAbs}
                          formatted={fmt(p.margemBruta, 3)}
                          color={p.margemBruta < 0 ? 'red' : 'green'}
                          align="near"
                        />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">
                        Nenhum produto corresponde à busca.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="sticky bottom-0">
                  <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                    <td className="px-4 py-2 text-left">Total:</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.quantidade)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.total)}</td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right tabular-nums',
                        totals.margem < 0 && 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {fmt(totals.margem, 3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                Exibindo {filtered.length} de {produtos.length} produtos
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GrupoProdutosModal
