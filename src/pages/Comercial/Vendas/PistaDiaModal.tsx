import { Calendar } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatDate, formatNumber } from '@/lib/formatters'
import BarCell from '@/components/tables/BarCell'

export interface PistaGrupoDetalhe {
  nome: string
  qtd: number
  fat: number
  custo: number
  lucro: number
}

export interface PistaDiaData {
  data: string // ISO yyyy-mm-dd
  qtd: number
  fat: number
  custo: number
  lucro: number
  grupos: PistaGrupoDetalhe[]
}

interface PistaDiaModalProps {
  open: boolean
  onClose: () => void
  detail: PistaDiaData | null
  /** Subtítulo do modal (default: pista). Permite reuso na Conveniência. */
  subtitle?: string
}

const PistaDiaModal = ({ open, onClose, detail, subtitle = 'Vendas de pista (loja)' }: PistaDiaModalProps) => {
  if (!detail) return null

  const margemPct = detail.fat > 0 ? (detail.lucro / detail.fat) * 100 : 0
  const precoMedio = detail.qtd > 0 ? detail.fat / detail.qtd : 0
  const custoMedio = detail.qtd > 0 ? detail.custo / detail.qtd : 0
  const lbMedio = detail.qtd > 0 ? detail.lucro / detail.qtd : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{formatDate(detail.data)}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* Faixa com contagem de grupos */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(detail.data)}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-gray-600 dark:text-gray-400">
              {detail.grupos.length} {detail.grupos.length === 1 ? 'grupo' : 'grupos'}
            </span>
          </div>

          {/* KPIs mini */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Qtde" value={formatNumber(Math.round(detail.qtd))} />
            <Kpi label="Faturamento" value={formatCurrencyInt(detail.fat)} />
            <Kpi label="Lucro bruto" value={formatCurrencyInt(detail.lucro)} />
            <Kpi label="Margem" value={`${margemPct.toFixed(2).replace('.', ',')}%`} />
          </div>

          {/* Composição por grupo */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Composição por grupo
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                  <th className="px-4 py-1.5 text-left font-medium">Grupo</th>
                  <th className="px-4 py-1.5 text-right font-medium">Qtde</th>
                  <th className="px-4 py-1.5 text-right font-medium">Faturamento</th>
                  <th className="px-4 py-1.5 text-right font-medium">Lucro bruto</th>
                  <th className="px-4 py-1.5 text-right font-medium">Margem</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxQtd = Math.max(...detail.grupos.map((g) => g.qtd), 0)
                  const maxFat = Math.max(...detail.grupos.map((g) => g.fat), 0)
                  const maxLb = Math.max(...detail.grupos.map((g) => g.lucro), 0)
                  return detail.grupos.map((g) => {
                    const gMargem = g.fat > 0 ? (g.lucro / g.fat) * 100 : 0
                    return (
                      <tr key={g.nome} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                        <td className="px-4 py-1.5 text-gray-700 dark:text-gray-300">
                          <span className="truncate" title={g.nome}>{g.nome}</span>
                        </td>
                        <td className="px-2 py-1">
                          <BarCell value={g.qtd} max={maxQtd} formatted={formatNumber(Math.round(g.qtd))} color="blue" align="near" />
                        </td>
                        <td className="px-2 py-1">
                          <BarCell value={g.fat} max={maxFat} formatted={formatCurrencyInt(g.fat)} color="green" align="near" />
                        </td>
                        <td className="px-2 py-1">
                          <BarCell value={g.lucro} max={maxLb} formatted={formatCurrencyInt(g.lucro)} color="green" align="near" />
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {`${gMargem.toFixed(2).replace('.', ',')}%`}
                        </td>
                      </tr>
                    )
                  })
                })()}
                <tr className="border-t border-gray-200 bg-gray-50 font-bold dark:border-gray-600 dark:bg-gray-800">
                  <td className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatNumber(Math.round(detail.qtd))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrencyInt(detail.fat)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrencyInt(detail.lucro)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {`${margemPct.toFixed(2).replace('.', ',')}%`}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Indicadores médios */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Indicadores do dia
            </div>
            <table className="w-full text-sm">
              <tbody>
                <DetailRow label="Preço médio" value={formatCurrency(precoMedio)} />
                <DetailRow label="Custo médio" value={formatCurrency(custoMedio)} />
                <DetailRow label="L.B. médio" value={formatCurrency(lbMedio)} />
              </tbody>
            </table>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
    <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
  </div>
)

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <tr className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
    <td className="px-4 py-1.5 text-left text-gray-700 dark:text-gray-300">{label}</td>
    <td className={cn('px-4 py-1.5 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200')}>{value}</td>
  </tr>
)

export default PistaDiaModal
