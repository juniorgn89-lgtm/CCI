import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { ReceivableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import type { TituloReceber } from '@/api/types/financeiro'

interface Props {
  open: boolean
  onClose: () => void
  nome: string
  score: number
  /** Títulos em aberto do cliente (snapshot de pendentes). */
  titulos: ReceivableRow[]
  /** Títulos pagos do cliente (últimos 6 meses). */
  pagos: TituloReceber[]
}

const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const convertido = (r: ReceivableRow) => (r as unknown as { convertido?: boolean | null }).convertido

/** Número do documento: tituloNumero → documento → #tituloCodigo (fallback). */
const numDoc = (r: ReceivableRow | TituloReceber) => {
  const n = (r as unknown as { tituloNumero?: number }).tituloNumero
  const d = (r as unknown as { documento?: string }).documento
  const cod = (r as unknown as { tituloCodigo?: number }).tituloCodigo
  return n ? String(n) : (d?.trim() || `#${cod ?? ''}`)
}

const scoreColor = (s: number) => (s >= 70 ? 'text-emerald-600 dark:text-emerald-400' : s >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')

const statusTitulo = (r: ReceivableRow) => {
  if (r.statusTag !== 'vencido') return { label: 'A vencer', cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400' }
  if (r.diasAtraso <= 30) return { label: 'Até 30d', cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400' }
  if (r.diasAtraso <= 90) return { label: '31–90d', cls: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400' }
  return { label: '+90d', cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400' }
}

/** Detalhamento completo dos documentos (em aberto + histórico de pagos) de um cliente. */
const ClienteRiscoModal = ({ open, onClose, nome, score, titulos, pagos }: Props) => {
  const resumo = useMemo(() => {
    const totalAberto = titulos.reduce((s, r) => s + r.valor, 0)
    const totalVencido = titulos.filter((r) => r.statusTag === 'vencido').reduce((s, r) => s + r.valor, 0)
    const maxDias = titulos.reduce((mx, r) => Math.max(mx, r.statusTag === 'vencido' ? r.diasAtraso : 0), 0)
    const naoFaturado = titulos.filter((r) => convertido(r) === false).reduce((s, r) => s + r.valor, 0)
    const ultimoPag = pagos.map((p) => onlyDate(p.dataPagamento)).filter(Boolean).sort().at(-1) ?? null
    const docDoc = titulos[0]?.cpfCnpjCliente
    return { totalAberto, totalVencido, maxDias, naoFaturado, ultimoPag, doc: docDoc }
  }, [titulos, pagos])

  const titulosOrd = useMemo(
    () => [...titulos].sort((a, b) => onlyDate(a.dataVencimento).localeCompare(onlyDate(b.dataVencimento))),
    [titulos],
  )
  const pagosOrd = useMemo(
    () => [...pagos].sort((a, b) => onlyDate(b.dataPagamento).localeCompare(onlyDate(a.dataPagamento))).slice(0, 20),
    [pagos],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {nome}
            <span className={cn('text-sm font-bold tabular-nums', scoreColor(score))}>· score {score}</span>
          </DialogTitle>
          <DialogDescription>
            {resumo.doc ? `${resumo.doc} · ` : ''}{titulos.length} título{titulos.length !== 1 ? 's' : ''} em aberto
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Chip label="Em aberto" value={formatCurrency(resumo.totalAberto)} />
          <Chip label="Vencido" value={formatCurrency(resumo.totalVencido)} tone={resumo.totalVencido > 0 ? 'red' : undefined} />
          <Chip label="Maior atraso" value={resumo.maxDias > 0 ? `${resumo.maxDias} dias` : '—'} />
          <Chip label="Último pagamento" value={resumo.ultimoPag ? brDate(resumo.ultimoPag) : '—'} />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Documentos em aberto */}
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Documentos em aberto</h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2 font-medium">Documento</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Faturada</th>
                    <th className="px-3 py-2 font-medium">Vencimento</th>
                    <th className="px-3 py-2 text-right font-medium">Dias atraso</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                    <th className="px-3 py-2 text-center font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {titulosOrd.map((r) => {
                    const st = statusTitulo(r)
                    const fat = convertido(r)
                    return (
                      <tr key={r.codigo} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{numDoc(r)}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.tipo || '—'}</td>
                        <td className="px-3 py-2">
                          {fat === false ? <span className="text-amber-600 dark:text-amber-400">Não</span>
                            : fat === true ? <span className="text-emerald-600 dark:text-emerald-400">Sim</span>
                              : <span className="text-gray-400">—</span>}
                        </td>
                        <td className={cn('px-3 py-2 tabular-nums', r.statusTag === 'vencido' ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300')}>{brDate(onlyDate(r.dataVencimento))}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.diasAtraso > 0 ? `${r.diasAtraso}d` : '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.valor)}</td>
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

          {/* Histórico de pagamentos */}
          <div>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Histórico de pagamentos (6 meses)</h4>
            {pagosOrd.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700">Sem pagamentos registrados no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2 font-medium">Documento</th>
                      <th className="px-3 py-2 font-medium">Vencimento</th>
                      <th className="px-3 py-2 font-medium">Pagamento</th>
                      <th className="px-3 py-2 text-right font-medium">Atraso</th>
                      <th className="px-3 py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pagosOrd.map((p) => {
                      const venc = onlyDate(p.dataVencimento); const pag = onlyDate(p.dataPagamento)
                      const atraso = venc && pag ? Math.round((new Date(pag).getTime() - new Date(venc).getTime()) / 86400000) : null
                      return (
                        <tr key={p.codigo}>
                          <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{numDoc(p)}</td>
                          <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{brDate(venc)}</td>
                          <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{brDate(pag)}</td>
                          <td className={cn('px-3 py-2 text-right tabular-nums', atraso != null && atraso > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                            {atraso == null ? '—' : atraso > 0 ? `${atraso}d` : atraso < 0 ? `${atraso}d` : 'no prazo'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(p.valor)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
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

export default ClienteRiscoModal
