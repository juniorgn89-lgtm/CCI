import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'

/**
 * Heatmap por coluna — tom mais saturado pros valores altos (azul/verde) ou
 * baixos (vermelho), em escala suave estilo PowerBI conditional formatting.
 * Total row recebe '' (sem tint) pra preservar destaque.
 */
const heatBlue = (value: number, min: number, max: number): string => {
  if (max <= min) return ''
  const ratio = (value - min) / (max - min)
  if (ratio > 0.66) return 'bg-blue-100 dark:bg-blue-900/40'
  if (ratio > 0.33) return 'bg-blue-50 dark:bg-blue-900/20'
  return ''
}

const heatGreen = (value: number, min: number, max: number): string => {
  if (max <= min) return ''
  const ratio = (value - min) / (max - min)
  if (ratio > 0.66) return 'bg-emerald-100 dark:bg-emerald-900/40'
  if (ratio > 0.33) return 'bg-emerald-50 dark:bg-emerald-900/20'
  return ''
}

const heatRed = (value: number, min: number, max: number): string => {
  if (max <= min) return ''
  const ratio = (value - min) / (max - min)
  // Inverso: menor valor = mais vermelho (sinal de alerta pra margens baixas).
  if (ratio < 0.33) return 'bg-red-100 dark:bg-red-900/40'
  if (ratio < 0.66) return 'bg-red-50 dark:bg-red-900/20'
  return ''
}

export interface FuelLineDetalhe {
  nome: string
  litros: number
  faturamento: number
  lucroBruto: number
  custo: number
}

export interface DetalheDiaData {
  data: string // ISO yyyy-mm-dd
  dayOfWeek: string
  litros: number
  faturamento: number
  lucroBruto: number
  custo: number
  variacaoSemanal: number | null
  acrescimos: number
  descontos: number
  fuels: FuelLineDetalhe[]
}

interface DetalheDiaModalProps {
  open: boolean
  onClose: () => void
  detail: DetalheDiaData | null
  /** Cor da bolinha por nome do combustível (mesma paleta da página). */
  fuelColor: (nome: string) => string
}

/** Formata percentual "+12,5%" / "−4,2%". */
const formatPct = (v: number): string => {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${Math.abs(v).toFixed(2).replace('.', ',')}%`
}

const DetalheDiaModal = ({ open, onClose, detail, fuelColor }: DetalheDiaModalProps) => {
  if (!detail) return null

  const margemPct = detail.faturamento > 0 ? (detail.lucroBruto / detail.faturamento) * 100 : 0
  const precoVenda = detail.litros > 0 ? detail.faturamento / detail.litros : 0
  const precoCusto = detail.litros > 0 ? detail.custo / detail.litros : 0
  const lbLitro = detail.litros > 0 ? detail.lucroBruto / detail.litros : 0

  const variacaoColor = detail.variacaoSemanal === null
    ? 'text-gray-400'
    : detail.variacaoSemanal > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : detail.variacaoSemanal < 0
        ? 'text-red-700 dark:text-red-400'
        : 'text-gray-600 dark:text-gray-400'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{formatDate(detail.data)}</DialogTitle>
          <DialogDescription>
            {detail.dayOfWeek} · Vendas de combustível
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* Faixa com dia da semana + variação semanal */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {detail.dayOfWeek}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-gray-600 dark:text-gray-400">
              {detail.fuels.length} {detail.fuels.length === 1 ? 'combustível' : 'combustíveis'}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            {detail.variacaoSemanal !== null && (
              <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium', variacaoColor,
                detail.variacaoSemanal > 0
                  ? 'bg-emerald-50 dark:bg-emerald-900/30'
                  : detail.variacaoSemanal < 0
                    ? 'bg-red-50 dark:bg-red-900/30'
                    : 'bg-gray-100 dark:bg-gray-800',
              )}>
                {detail.variacaoSemanal > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : detail.variacaoSemanal < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {formatPct(detail.variacaoSemanal)} vs. semana anterior
              </span>
            )}
          </div>

          {/* KPIs mini */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Litros" value={formatNumber(detail.litros)} />
            <Kpi label="Faturamento" value={formatCurrency(detail.faturamento)} />
            <Kpi label="Lucro bruto" value={formatCurrency(detail.lucroBruto)} />
            <Kpi label="Margem" value={`${margemPct.toFixed(2).replace('.', ',')}%`} />
          </div>

          {/* Composição por combustível */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Composição por combustível
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                  <th className="px-4 py-1.5 text-left font-medium">Combustível</th>
                  <th className="px-4 py-1.5 text-right font-medium">Litros</th>
                  <th className="px-4 py-1.5 text-right font-medium">Faturamento</th>
                  <th className="px-4 py-1.5 text-right font-medium">Lucro bruto</th>
                  <th className="px-4 py-1.5 text-right font-medium">L.B./Litro</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Faixas por coluna — define a escala do heatmap. Min/max do
                  // próprio set (3..N combustíveis) pra contraste útil mesmo
                  // quando os valores absolutos são bem diferentes entre dias.
                  const litrosArr = detail.fuels.map((f) => f.litros)
                  const lucroArr = detail.fuels.map((f) => f.lucroBruto)
                  const lbArr = detail.fuels.map((f) => (f.litros > 0 ? f.lucroBruto / f.litros : 0))
                  const litRange = { min: Math.min(...litrosArr, 0), max: Math.max(...litrosArr, 0) }
                  const lucRange = { min: Math.min(...lucroArr, 0), max: Math.max(...lucroArr, 0) }
                  const lbRange = { min: Math.min(...lbArr, 0), max: Math.max(...lbArr, 0) }
                  return detail.fuels.map((f) => {
                    const fLb = f.litros > 0 ? f.lucroBruto / f.litros : 0
                    return (
                      <tr key={f.nome} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                        <td className="px-4 py-1.5 text-gray-700 dark:text-gray-300">
                          <span className="flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 rounded-full', fuelColor(f.nome))} aria-hidden="true" />
                            <span className="truncate" title={f.nome}>{f.nome}</span>
                          </span>
                        </td>
                        <td className={cn('px-4 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300', heatBlue(f.litros, litRange.min, litRange.max))}>
                          {formatNumber(f.litros)}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {formatCurrency(f.faturamento)}
                        </td>
                        <td className={cn('px-4 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300', heatGreen(f.lucroBruto, lucRange.min, lucRange.max))}>
                          {formatCurrency(f.lucroBruto)}
                        </td>
                        <td className={cn('px-4 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300', heatRed(fLb, lbRange.min, lbRange.max))}>
                          {formatCurrency(fLb)}
                        </td>
                      </tr>
                    )
                  })
                })()}
                <tr className="border-t border-gray-200 bg-gray-50 font-bold dark:border-gray-600 dark:bg-gray-800">
                  <td className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatNumber(detail.litros)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(detail.faturamento)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(detail.lucroBruto)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(lbLitro)}
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
                <DetailRow label="Preço médio de venda" value={formatCurrency(precoVenda)} />
                <DetailRow label="Preço médio de custo" value={formatCurrency(precoCusto)} />
                <DetailRow label="L.B. por litro" value={formatCurrency(lbLitro)} />
                <DetailRow label="Acréscimos" value={formatCurrency(detail.acrescimos)} muted />
                <DetailRow label="Descontos" value={formatCurrency(detail.descontos)} muted />
              </tbody>
            </table>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface KpiProps {
  label: string
  value: string
  valueClass?: string
}

const Kpi = ({ label, value, valueClass }: KpiProps) => (
  <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
    <p className={cn('mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100', valueClass)}>
      {value}
    </p>
  </div>
)

const DetailRow = ({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) => (
  <tr className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
    <td className="px-4 py-1.5 text-left text-gray-700 dark:text-gray-300">{label}</td>
    <td className={cn(
      'px-4 py-1.5 text-right text-sm tabular-nums',
      muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200',
    )}>
      {value}
    </td>
  </tr>
)

export default DetalheDiaModal
