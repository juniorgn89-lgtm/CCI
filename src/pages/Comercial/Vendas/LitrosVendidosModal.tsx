import { useState } from 'react'
import { Droplets, ChevronDown, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'
import { formatLiters, formatDate } from '@/lib/formatters'
import useLmcReconciliacao, { type ReconRow, type ReconStatus, RECON_OK_PCT, RECON_ATENCAO_PCT } from '@/pages/Operacao/hooks/useLmcReconciliacao'

interface Props {
  open: boolean
  onClose: () => void
  dataInicial: string
  dataFinal: string
}

const STATUS_STYLE: Record<ReconStatus, { dot: string; label: string; text: string }> = {
  ok: { dot: 'bg-emerald-500', label: 'Normal', text: 'text-emerald-600 dark:text-emerald-400' },
  atencao: { dot: 'bg-amber-500', label: 'Atenção', text: 'text-amber-600 dark:text-amber-400' },
  alerta: { dot: 'bg-red-500', label: 'Alerta', text: 'text-red-600 dark:text-red-400' },
}

/** Litros com sinal explícito (perda negativa / sobra positiva). */
const fmtSigned = (v: number): string => `${v > 0 ? '+' : ''}${formatLiters(v)}`
const fmtPct = (v: number | null): string =>
  v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`

/** Operador da equação no cabeçalho (+ − =), em tom suave. */
const Op = ({ children }: { children: string }) => (
  <span className="mr-1 font-normal text-gray-300 dark:text-gray-600">{children}</span>
)

/**
 * Drill-down do card "Litros Vendidos" (Vendas → Combustível): reconciliação
 * de combustível via LMC (físico medido vs teórico) por produto + guia.
 */
const LitrosVendidosModal = ({ open, onClose, dataInicial, dataFinal }: Props) => {
  const { rows, totais, isLoading } = useLmcReconciliacao(open)
  const [guiaAberto, setGuiaAberto] = useState(false)

  const periodo = dataInicial === dataFinal ? formatDate(dataInicial) : `${formatDate(dataInicial)} – ${formatDate(dataFinal)}`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-100 dark:bg-cyan-900/40">
                <Droplets className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              </span>
              Litros Vendidos · Conferência de combustível
            </span>
          </DialogTitle>
          <DialogDescription>
            Perda/sobra por produto no período ({periodo}) — estoque medido vs. teórico (físico × fiscal), via o LMC (Livro de Movimentação de Combustíveis).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Sem dados de LMC no período.</p>
          ) : (
            <section className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                    <th className="px-2.5 py-2 text-left font-medium">Produto</th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium">Abertura</th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium"><Op>+</Op>Entrada</th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium"><Op>−</Op>Saída</th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1"><Op>=</Op>Estoque teórico <InfoHint text="Estoque que DEVERIA ter no tanque ao fim do período = Abertura + Entradas (compras) − Saídas (vendas)." /></span>
                    </th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">Medido <InfoHint text="Estoque físico medido (fechamento do tanque pela régua/automação)." /></span>
                    </th>
                    <th className="px-2.5 py-2 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">Perda/Sobra <InfoHint text="Medido − Teórico. Negativo = perda (evaporação, calibração, desvio); positivo = sobra." /></span>
                    </th>
                    <th className="px-2.5 py-2 text-right font-medium">%</th>
                    <th className="px-2.5 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((r) => <Row key={r.produtoCodigo} r={r} />)}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                    <td className="px-2.5 py-2.5">Total</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-right tabular-nums">{formatLiters(totais.abertura)}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-right tabular-nums">{formatLiters(totais.entrada)}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-right tabular-nums">{formatLiters(totais.saida)}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-right tabular-nums">{formatLiters(totais.teorico)}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-right tabular-nums">{formatLiters(totais.fechamento)}</td>
                    <td className={cn('px-2.5 py-2.5 whitespace-nowrap text-right tabular-nums', totais.perdaSobra < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{fmtSigned(totais.perdaSobra)}</td>
                    <td className="px-2.5 py-2.5 whitespace-nowrap text-right tabular-nums">{fmtPct(totais.perdaPct)}</td>
                    <td className="px-2.5 py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          {/* Guia "Como é calculado?" */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setGuiaAberto((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400"
            >
              <span className="inline-flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Como é calculado?</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', guiaAberto && 'rotate-180')} />
            </button>
            {guiaAberto && (
              <div className="space-y-2 border-t border-gray-200 px-4 py-3 text-xs leading-relaxed text-gray-600 dark:border-gray-700 dark:text-gray-300">
                <p><strong>Saída</strong> = litros vendidos (itens de venda autorizados) — é o valor do card "Litros Vendidos".</p>
                <p><strong>Estoque teórico</strong> = Abertura + Entradas (compras) − Saídas (vendas).</p>
                <p><strong>Estoque medido</strong> = fechamento do tanque (régua/automação).</p>
                <p><strong>Perda/Sobra</strong> = Medido − Teórico. Diferenças pequenas são normais (evaporação, temperatura, tolerância de calibração ~0,5%, aferição); grandes indicam vazamento/desvio.</p>
                <p className="text-gray-400">Fonte: LMC (Livro de Movimentação de Combustíveis). Faixas: 🟢 ≤ {RECON_OK_PCT.toLocaleString('pt-BR')}% · 🟡 {RECON_OK_PCT.toLocaleString('pt-BR')}–{RECON_ATENCAO_PCT.toLocaleString('pt-BR')}% · 🔴 &gt; {RECON_ATENCAO_PCT.toLocaleString('pt-BR')}%. A medição de tanque aparece só aqui, como conferência; as telas de operação seguem na base fiscal.</p>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Row = ({ r }: { r: ReconRow }) => {
  const st = STATUS_STYLE[r.status]
  return (
    <tr className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
      <td className="px-2.5 py-2 font-medium text-gray-900 dark:text-gray-100">{r.nome}</td>
      <td className="px-2.5 py-2 whitespace-nowrap text-right tabular-nums text-gray-600 dark:text-gray-400">{formatLiters(r.abertura)}</td>
      <td className="px-2.5 py-2 whitespace-nowrap text-right tabular-nums text-gray-600 dark:text-gray-400">{formatLiters(r.entrada)}</td>
      <td className="px-2.5 py-2 whitespace-nowrap text-right tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(r.saida)}</td>
      <td className="px-2.5 py-2 whitespace-nowrap text-right tabular-nums text-gray-600 dark:text-gray-400">{formatLiters(r.teorico)}</td>
      <td className="px-2.5 py-2 whitespace-nowrap text-right tabular-nums text-gray-600 dark:text-gray-400">{formatLiters(r.fechamento)}</td>
      <td className={cn('whitespace-nowrap px-2.5 py-2 text-right font-medium tabular-nums', r.perdaSobra < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{fmtSigned(r.perdaSobra)}</td>
      <td className={cn('px-2.5 py-2 whitespace-nowrap text-right tabular-nums', st.text)}>{fmtPct(r.perdaPct)}</td>
      <td className="px-2.5 py-2">
        <span className="inline-flex items-center justify-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', st.dot)} />
          <span className={cn('text-[11px] font-medium', st.text)}>{st.label}</span>
        </span>
      </td>
    </tr>
  )
}

export default LitrosVendidosModal
