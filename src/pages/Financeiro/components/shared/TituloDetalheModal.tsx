import { ArrowDownLeft, ArrowUpRight, CalendarDays, Building2, FileText, Lock, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import { GUIAS } from '@/lib/guiasModais'
import { relDias } from '@/pages/Dashboard/components/modais/util'

export interface TituloDetalhe {
  lado: 'receber' | 'pagar'
  /** Cliente ou fornecedor. */
  nome: string
  sub?: string
  posto: string
  instrumento: { label: string; Icon: LucideIcon; badge: string }
  vencimento: string
  vencido: boolean
  diasAtraso: number
  /** O que falta (saldo a receber / a pagar). */
  saldo: number
  /** Valor cheio e o já pago — quando houver baixa parcial ou ajuste. */
  bruto?: number
  pago?: number
  campos: { label: string; value: string }[]
  /** Fatura: as notas que a compõem. */
  notas?: { key: string; numero: string; vencimento: string; valor: number }[]
}

const brData = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

/** Detalhe de um título a receber ou a pagar — só leitura (a baixa é feita no ERP). */
const TituloDetalheModal = ({ t, onClose }: { t: TituloDetalhe | null; onClose: () => void }) => {
  if (!t) return null
  const receber = t.lado === 'receber'
  const LadoIcon = receber ? ArrowDownLeft : ArrowUpRight
  const bruto = t.bruto ?? t.saldo
  const pago = t.pago ?? 0
  const ajuste = t.saldo + pago - bruto
  const temQuebra = pago >= 0.005 || Math.abs(ajuste) >= 0.005
  const pctPago = bruto > 0 ? Math.min(100, (pago / bruto) * 100) : 0
  const tomStatus = t.vencido
    ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/50'
    : 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900/50'

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent guia={GUIAS.tituloDetalhe} className="max-h-[88vh] w-[95vw] max-w-2xl gap-0 overflow-y-auto p-0">
        {/* Cabeçalho */}
        <DialogHeader className="space-y-0 border-b border-gray-100 px-6 pb-4 pt-5 text-left dark:border-gray-800">
          <div className="flex items-start gap-3 pr-8">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', receber ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300')}>
              <LadoIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">{receber ? 'Conta a receber' : 'Conta a pagar'}</p>
              <DialogTitle className="text-[17px] font-bold leading-snug text-gray-900 dark:text-gray-100">{t.nome}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', t.instrumento.badge)}><t.instrumento.Icon className="h-3 w-3" />{t.instrumento.label}</span>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', tomStatus)}>{t.vencido ? `Atrasado · ${t.diasAtraso} ${t.diasAtraso === 1 ? 'dia' : 'dias'}` : 'A vencer'}</span>
                {t.sub && <span className="truncate">{t.sub}</span>}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {/* Valor + vencimento */}
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
            <div className={cn('rounded-xl border px-4 py-3', receber ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20')}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{receber ? 'Saldo a receber' : 'Saldo a pagar'}</p>
              <p className="mt-0.5 text-[26px] font-extrabold tabular-nums leading-tight text-gray-900 dark:text-white">{formatCurrency(t.saldo)}</p>
              {temQuebra && (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-gray-800"><div className={cn('h-full rounded-full', receber ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: `${pctPago}%` }} /></div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    <span>Valor {formatCurrency(bruto)}</span>
                    {Math.abs(ajuste) >= 0.005 && <span>{ajuste < 0 ? 'Descontos' : 'Acréscimos'} {formatCurrency(ajuste)}</span>}
                    {pago >= 0.005 && <span>Pago {formatCurrency(pago)}</span>}
                  </p>
                </>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
              <p className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"><CalendarDays className="h-3.5 w-3.5" /> Vencimento</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brData(t.vencimento)}</p>
              <p className={cn('text-[12px] font-medium', t.vencido ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>{relDias(t.vencimento)}</p>
            </div>
          </div>

          {/* Campos */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-3 dark:border-gray-700 dark:bg-gray-700">
            <Campo label="Posto" value={t.posto} Icon={Building2} />
            {t.campos.map((c) => <Campo key={c.label} label={c.label} value={c.value} />)}
            {/* Completa a última linha da grade (2 colunas no celular, 3 no resto) sem buraco cinza. */}
            {Array.from({ length: (3 - ((t.campos.length + 1) % 3)) % 3 }).map((_, i) => <div key={`f3${i}`} className="hidden bg-white sm:block dark:bg-gray-900" />)}
            {(t.campos.length + 1) % 2 === 1 && <div className="bg-white sm:hidden dark:bg-gray-900" />}
          </div>

          {/* Notas da fatura */}
          {t.notas && t.notas.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"><FileText className="h-3.5 w-3.5" /> {t.notas.length} {t.notas.length === 1 ? 'nota' : 'notas'} nesta fatura</p>
              <div className="max-h-56 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400 dark:bg-gray-900">
                    <tr><th className="px-3 py-1.5 text-left font-semibold">Nota</th><th className="px-3 py-1.5 text-left font-semibold">Vencimento</th><th className="px-3 py-1.5 text-right font-semibold">Valor</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {t.notas.map((n) => (
                      <tr key={n.key}>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{n.numero}</td>
                        <td className="px-3 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{brData(n.vencimento)}</td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(n.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><Lock className="h-3 w-3" /> Só leitura: a baixa {receber ? 'do recebimento' : 'do pagamento'} é feita no ERP. Fonte: títulos pendentes no ERP.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Campo = ({ label, value, Icon }: { label: string; value: string; Icon?: LucideIcon }) => (
  <div className="bg-white px-3.5 py-2.5 dark:bg-gray-900">
    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{Icon && <Icon className="h-3 w-3" />}{label}</p>
    <p className="mt-0.5 break-words text-[13px] font-medium tabular-nums text-gray-800 dark:text-gray-100">{value || '—'}</p>
  </div>
)

export default TituloDetalheModal
