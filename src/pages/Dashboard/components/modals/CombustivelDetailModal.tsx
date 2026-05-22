import { useMemo, useState } from 'react'
import { Droplets, CalendarRange } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort, formatLiters, formatCurrencyTooltip, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import BarCell from '@/components/tables/BarCell'
import ProdutoDrilldownModal, { type DrilldownPayload } from './ProdutoDrilldownModal'
import SegmentKpiMini from './SegmentKpiMini'
import { buildDateRange, buildDrilldownRows, distributeAcrossRows, generateDailyEvolution } from './segmentMockHelpers'

interface CombustivelDetailModalProps {
  open: boolean
  onClose: () => void
  dataInicial: string
  dataFinal: string
  totalLucroBruto: number
  margemPct: number
  lucroPorLitro: number
}

const PRODUTOS = [
  'Gasolina Comum',
  'Gasolina Aditivada',
  'Etanol Comum',
  'Etanol Aditivado',
  'Diesel S-10',
  'Diesel S-10 Aditivado',
]

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

const fmtPeriod = (di: string, df: string): string => {
  const a = di.split('-').reverse().join('/')
  const b = df.split('-').reverse().join('/')
  return `${a} — ${b}`
}

const CombustivelDetailModal = ({
  open,
  onClose,
  dataInicial,
  dataFinal,
  totalLucroBruto,
  margemPct,
  lucroPorLitro,
}: CombustivelDetailModalProps) => {
  const [drilldown, setDrilldown] = useState<DrilldownPayload | null>(null)

  const data = useMemo(() => {
    const faturamento = margemPct > 0 ? totalLucroBruto / (margemPct / 100) : totalLucroBruto * 8
    const custo = faturamento - totalLucroBruto
    const litrosTotal = lucroPorLitro > 0 ? totalLucroBruto / lucroPorLitro : 800000
    const ticketMedio = 285.4
    const qtdVendas = Math.round(faturamento / ticketMedio)

    const variations = {
      faturamento: 4.7,
      custo: 3.9,
      ticket: -1.2,
      qtd: 5.8,
    }

    const dates = buildDateRange(dataInicial, dataFinal)
    const dailyChart = generateDailyEvolution('combustivel', dates, faturamento)

    const fatPerRow = distributeAcrossRows('combustivel-fat', PRODUTOS.length, faturamento)
    const litrosPerRow = distributeAcrossRows('combustivel-lit', PRODUTOS.length, litrosTotal)
    const marginPerRow = distributeAcrossRows('combustivel-mar', PRODUTOS.length, totalLucroBruto)

    const rows = PRODUTOS.map((nome, i) => {
      const fat = fatPerRow[i]
      const litros = litrosPerRow[i]
      const margem = marginPerRow[i]
      const marPct = fat > 0 ? (margem / fat) * 100 : 0
      const rPorL = litros > 0 ? margem / litros : 0
      return { nome, litros, faturamento: fat, margem, margemPct: marPct, rPorL }
    })

    return {
      faturamento,
      custo,
      ticketMedio,
      qtdVendas,
      litrosTotal,
      variations,
      dailyChart,
      rows,
      dates,
    }
  }, [dataInicial, dataFinal, totalLucroBruto, margemPct, lucroPorLitro])

  const maxFat = Math.max(...data.rows.map((r) => r.faturamento))
  const maxMargem = Math.max(...data.rows.map((r) => Math.abs(r.margem)))

  const handleRowClick = (row: typeof data.rows[number]) => {
    setDrilldown({
      nome: row.nome,
      unidade: 'L',
      quantidade: row.litros,
      faturamento: row.faturamento,
      margem: row.margem,
      margemPct: row.margemPct,
      dailyRows: buildDrilldownRows(`combustivel-${row.nome}`, data.dates, row.litros, row.faturamento, row.margem),
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-blue-700 dark:text-blue-300">Combustível</DialogTitle>
                <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {fmtPeriod(dataInicial, dataFinal)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SegmentKpiMini label="Faturamento" value={formatCurrencyInt(data.faturamento)} variation={data.variations.faturamento} />
            <SegmentKpiMini label="Custo" value={formatCurrencyInt(data.custo)} variation={data.variations.custo} invertColor />
            <SegmentKpiMini label="Ticket médio" value={formatCurrency(data.ticketMedio)} variation={data.variations.ticket} />
            <SegmentKpiMini label="Quantidade vendida" value={formatLiters(data.litrosTotal)} variation={data.variations.qtd} />
          </div>

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
                  formatter={(v: number) => [formatCurrencyTooltip(v), 'Faturamento']}
                  labelFormatter={(label: string, payload) => payload?.[0]?.payload?.data?.split('-').reverse().join('/') ?? label}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line type="monotone" dataKey="faturamento" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="-mx-6 flex-1 overflow-auto px-6">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-right">Litros</th>
                  <th className="px-2 py-2 text-right">Faturamento</th>
                  <th className="px-2 py-2 text-right">Margem (R$)</th>
                  <th className="px-3 py-2 text-right">Margem (%)</th>
                  <th className="px-3 py-2 text-right">R$/L</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.nome}
                    onClick={() => handleRowClick(row)}
                    className="cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 hover:bg-blue-50/40 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-blue-900/10"
                  >
                    <td className="px-3 py-1.5 text-left font-medium">{row.nome}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(Math.round(row.litros))}</td>
                    <td className="px-2 py-1">
                      <BarCell value={row.faturamento} max={maxFat} formatted={formatCurrencyInt(row.faturamento)} color="blue" align="near" />
                    </td>
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
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.rPorL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Exibindo {data.rows.length} produtos · Faturamento total: {formatCurrencyInt(data.faturamento)} · Margem média: {fmtPct(margemPct)}
          </p>
        </DialogContent>
      </Dialog>

      <ProdutoDrilldownModal
        open={drilldown !== null}
        onClose={() => setDrilldown(null)}
        payload={drilldown}
        accentClass="text-blue-700 dark:text-blue-300"
      />
    </>
  )
}

export default CombustivelDetailModal
