import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  open: boolean
  onClose: () => void
  nome: string
  /** Títulos a pagar em aberto do fornecedor. */
  titulos: PayableRow[]
}

const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const todayISO = () => new Date().toISOString().split('T')[0]
const addDaysISO = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }
const getStr = (r: PayableRow, k: string) => (r as unknown as Record<string, unknown>)[k] as string | undefined
const centroCusto = (r: PayableRow) => getStr(r, 'centroCustoDescricao')?.trim() || '—'
const categoria = (r: PayableRow) => getStr(r, 'planoContaGerencialDescricao')?.trim() || '—'
const numTitulo = (r: PayableRow) => getStr(r, 'numeroTitulo')?.trim() || `#${(r as unknown as { tituloPagarCodigo?: number }).tituloPagarCodigo ?? ''}`

const statusTit = (r: PayableRow, hoje: string) => {
  const venc = onlyDate(r.vencimento)
  if (r.statusTag === 'vencido') return { label: 'Em atraso', cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400' }
  if (venc === hoje) return { label: 'Vence hoje', cls: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400' }
  if (venc <= addDaysISO(hoje, 7)) return { label: 'Vence em breve', cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400' }
  return { label: 'Em dia', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' }
}

/** Detalhamento completo dos títulos a pagar em aberto de um fornecedor. */
const FornecedorPagarModal = ({ open, onClose, nome, titulos }: Props) => {
  const hoje = todayISO()
  const resumo = useMemo(() => {
    const totalAberto = titulos.reduce((s, r) => s + r.saldoRestante, 0)
    const totalVencido = titulos.filter((r) => r.statusTag === 'vencido').reduce((s, r) => s + r.saldoRestante, 0)
    const totalAVencer = totalAberto - totalVencido
    const maxDias = titulos.reduce((mx, r) => Math.max(mx, r.statusTag === 'vencido' ? r.diasAtraso : 0), 0)
    const doc = getStr(titulos[0] ?? ({} as PayableRow), 'cpfCnpjFornecedor')
    return { totalAberto, totalVencido, totalAVencer, maxDias, doc }
  }, [titulos])

  const ord = useMemo(
    () => [...titulos].sort((a, b) => onlyDate(a.vencimento).localeCompare(onlyDate(b.vencimento))),
    [titulos],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{nome}</DialogTitle>
          <DialogDescription>
            {resumo.doc ? `${resumo.doc} · ` : ''}{titulos.length} título{titulos.length !== 1 ? 's' : ''} a pagar em aberto
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Chip label="Em aberto" value={formatCurrency(resumo.totalAberto)} />
          <Chip label="Vencido" value={formatCurrency(resumo.totalVencido)} tone={resumo.totalVencido > 0 ? 'red' : undefined} />
          <Chip label="A vencer" value={formatCurrency(resumo.totalAVencer)} />
          <Chip label="Maior atraso" value={resumo.maxDias > 0 ? `${resumo.maxDias} dias` : '—'} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">Documento</th>
                  <th className="px-3 py-2 font-medium">Emissão</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-right font-medium">Dias atraso</th>
                  <th className="px-3 py-2 font-medium">Centro de custo</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ord.map((r) => {
                  const st = statusTit(r, hoje)
                  return (
                    <tr key={r.codigo} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 font-medium tabular-nums text-gray-700 dark:text-gray-300">{numTitulo(r)}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{brDate(onlyDate(r.dataMovimento))}</td>
                      <td className={cn('px-3 py-2 tabular-nums', r.statusTag === 'vencido' ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300')}>{brDate(onlyDate(r.vencimento))}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.saldoRestante)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.diasAtraso > 0 ? `${r.diasAtraso}d` : '—'}</td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-gray-500 dark:text-gray-400" title={centroCusto(r)}>{centroCusto(r)}</td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-gray-500 dark:text-gray-400" title={categoria(r)}>{categoria(r)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', st.cls)}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Chip = ({ label, value, tone }: { label: string; value: string; tone?: 'red' }) => (
  <div className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className={cn('mt-0.5 text-sm font-bold tabular-nums', tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
  </div>
)

export default FornecedorPagarModal
