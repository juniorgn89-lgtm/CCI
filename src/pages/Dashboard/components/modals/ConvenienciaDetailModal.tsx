import { useMemo, useState } from 'react'
import { Store, CalendarRange } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import BarCell from '@/components/tables/BarCell'
import ProdutoDrilldownModal, { type DrilldownPayload } from './ProdutoDrilldownModal'
import SegmentKpiMini from './SegmentKpiMini'
import { buildDateRange, buildDrilldownRows, distributeAcrossRows, generateDailyEvolution } from './segmentMockHelpers'

interface ConvenienciaDetailModalProps {
  open: boolean
  onClose: () => void
  dataInicial: string
  dataFinal: string
  totalFaturamento: number
  totalLucroBruto: number
  margemPct: number
}

const GRUPOS_CONV = [
  'LJ-BEBIDAS',
  'LJ-CERVEJAS',
  'LJ-FAST-FOOD',
  'LJ-TABACARIA',
  'LJ-SNACKS',
  'LJ-CONGELADOS',
  'LJ-DOCES',
  'LJ-HIGIENE',
  'LJ-LATICINIOS',
]

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

const fmtPeriod = (di: string, df: string): string => {
  const a = di.split('-').reverse().join('/')
  const b = df.split('-').reverse().join('/')
  return `${a} — ${b}`
}

const ConvenienciaDetailModal = ({
  open,
  onClose,
  dataInicial,
  dataFinal,
  totalFaturamento,
  totalLucroBruto,
  margemPct,
}: ConvenienciaDetailModalProps) => {
  const [drilldown, setDrilldown] = useState<DrilldownPayload | null>(null)

  const data = useMemo(() => {
    const custo = totalFaturamento - totalLucroBruto
    const ticketMedio = 24.8
    const qtdVendas = Math.round(totalFaturamento / ticketMedio)

    const variations = {
      faturamento: 3.4,
      custo: 2.1,
      ticket: 0.9,
      qtd: 2.5,
    }

    const dates = buildDateRange(dataInicial, dataFinal)
    const dailyChart = generateDailyEvolution('conveniencia', dates, totalFaturamento)

    const fatPerRow = distributeAcrossRows('conv-fat', GRUPOS_CONV.length, totalFaturamento)
    const qtdPerRow = distributeAcrossRows('conv-qtd', GRUPOS_CONV.length, qtdVendas)
    const marginPerRow = distributeAcrossRows('conv-mar', GRUPOS_CONV.length, totalLucroBruto)

    const rows = GRUPOS_CONV.map((nome, i) => {
      const fat = fatPerRow[i]
      const qtd = Math.max(1, Math.round(qtdPerRow[i]))
      const margem = marginPerRow[i]
      const cst = fat - margem
      const marPct = fat > 0 ? (margem / fat) * 100 : 0
      return { nome, qtd, faturamento: fat, custo: cst, margem, margemPct: marPct }
    })

    return { custo, ticketMedio, qtdVendas, variations, dailyChart, rows, dates }
  }, [dataInicial, dataFinal, totalFaturamento, totalLucroBruto])

  const maxFat = Math.max(...data.rows.map((r) => r.faturamento))
  const maxMargem = Math.max(...data.rows.map((r) => Math.abs(r.margem)))

  const handleRowClick = (row: typeof data.rows[number]) => {
    setDrilldown({
      nome: row.nome,
      unidade: 'un',
      quantidade: row.qtd,
      faturamento: row.faturamento,
      margem: row.margem,
      margemPct: row.margemPct,
      dailyRows: buildDrilldownRows(`conv-${row.nome}`, data.dates, row.qtd, row.faturamento, row.margem),
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Store className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-emerald-700 dark:text-emerald-300">Conveniência</DialogTitle>
                <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {fmtPeriod(dataInicial, dataFinal)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SegmentKpiMini label="Faturamento" value={formatCurrencyInt(totalFaturamento)} variation={data.variations.faturamento} />
            <SegmentKpiMini label="Custo" value={formatCurrencyInt(data.custo)} variation={data.variations.custo} invertColor />
            <SegmentKpiMini label="Ticket médio" value={formatCurrency(data.ticketMedio)} variation={data.variations.ticket} />
            <SegmentKpiMini label="Quantidade vendida" value={formatNumber(data.qtdVendas)} variation={data.variations.qtd} />
          </div>

          {data.dailyChart.length >= 2 && (
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Faturamento diário
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data.dailyChart} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
                <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  formatter={((v: number) => [formatCurrencyTooltip(v), 'Faturamento']) as never}
                  labelFormatter={((label: string, payload: { payload?: { data?: string } }[]) => payload?.[0]?.payload?.data?.split('-').reverse().join('/') ?? label) as never}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line type="monotone" dataKey="faturamento" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

          <div className="-mx-6 flex-1 overflow-auto px-6">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-3 py-2 text-left">Grupo</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-2 py-2 text-right">Faturamento</th>
                  <th className="px-3 py-2 text-right">Custo</th>
                  <th className="px-2 py-2 text-right">Margem (R$)</th>
                  <th className="px-3 py-2 text-right">Margem (%)</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.nome}
                    onClick={() => handleRowClick(row)}
                    className="cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 hover:bg-emerald-50/50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-emerald-900/10"
                  >
                    <td className="px-3 py-1.5 text-left font-medium">{row.nome}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(row.qtd)}</td>
                    <td className="px-2 py-1">
                      <BarCell value={row.faturamento} max={maxFat} formatted={formatCurrencyInt(row.faturamento)} color="blue" align="near" />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatCurrencyInt(row.custo)}</td>
                    <td className="px-2 py-1">
                      <BarCell
                        value={Math.abs(row.margem)}
                        max={maxMargem}
                        formatted={formatCurrencyInt(row.margem)}
                        color={row.margem < 0 ? 'red' : 'green'}
                        align="near"
                      />
                    </td>
                    <td className={cn('px-3 py-1.5 text-right tabular-nums', row.margemPct < 0 && 'text-red-700 dark:text-red-400')}>
                      {fmtPct(row.margemPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Exibindo {data.rows.length} grupos · Faturamento total: {formatCurrencyInt(totalFaturamento)} · Margem média: {fmtPct(margemPct)}
          </p>
        </DialogContent>
      </Dialog>

      <ProdutoDrilldownModal
        open={drilldown !== null}
        onClose={() => setDrilldown(null)}
        payload={drilldown}
        accentClass="text-emerald-700 dark:text-emerald-300"
      />
    </>
  )
}

export default ConvenienciaDetailModal
