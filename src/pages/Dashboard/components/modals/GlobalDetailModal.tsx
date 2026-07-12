import { useMemo } from 'react'
import { Globe, CalendarRange, Droplets, Wrench, Store } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrencyInt, formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/lib/chartTheme'
import BarCell from '@/components/tables/BarCell'
import SegmentKpiMini from './SegmentKpiMini'
import { useFilterStore } from '@/store/filters'
import { buildDateRange, distributeAcrossRows, generateDailyEvolution } from './segmentMockHelpers'

interface SegmentTotals {
  faturamento: number
  lucroBruto: number
  margem: number
}

interface GlobalDetailModalProps {
  open: boolean
  onClose: () => void
  dataInicial: string
  dataFinal: string
  global: SegmentTotals
  combustivel: SegmentTotals
  automotivos: SegmentTotals
  conveniencia: SegmentTotals
}

const POSTOS = [
  { codigo: 1, nome: 'POSTO ITAPOA' },
  { codigo: 2, nome: 'POSTO DIVINO' },
  { codigo: 3, nome: 'POSTO TREVISO' },
  { codigo: 4, nome: 'POSTO DARWIN' },
  { codigo: 5, nome: 'COMPLEXO COSTA AZUL' },
]

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

const fmtPeriod = (di: string, df: string): string => {
  const a = di.split('-').reverse().join('/')
  const b = df.split('-').reverse().join('/')
  return `${a} — ${b}`
}

const GlobalDetailModal = ({
  open,
  onClose,
  dataInicial,
  dataFinal,
  global,
  combustivel,
  automotivos,
  conveniencia,
}: GlobalDetailModalProps) => {
  const ct = useChartTheme()
  const setEmpresas = useFilterStore((s) => s.setEmpresas)

  const data = useMemo(() => {
    const variations = {
      faturamento: 5.1,
      lucro: 4.3,
      margem: -0.6,
    }

    const dates = buildDateRange(dataInicial, dataFinal)
    const combChart = generateDailyEvolution('global-comb', dates, combustivel.faturamento)
    const autoChart = generateDailyEvolution('global-auto', dates, automotivos.faturamento)
    const convChart = generateDailyEvolution('global-conv', dates, conveniencia.faturamento)

    const dailyChart = dates.map((d, i) => ({
      data: d,
      label: combChart[i]?.label ?? d,
      Combustível: combChart[i]?.faturamento ?? 0,
      Automotivos: autoChart[i]?.faturamento ?? 0,
      Conveniência: convChart[i]?.faturamento ?? 0,
    }))

    const fatPerPosto = distributeAcrossRows('global-postos-fat', POSTOS.length, global.faturamento)
    const lbrPerPosto = distributeAcrossRows('global-postos-lbr', POSTOS.length, global.lucroBruto)

    const ranking = POSTOS.map((p, i) => {
      const fat = fatPerPosto[i]
      const lbr = lbrPerPosto[i]
      const marPct = fat > 0 ? (lbr / fat) * 100 : 0
      return { ...p, faturamento: fat, lucroBruto: lbr, margem: marPct }
    }).sort((a, b) => b.faturamento - a.faturamento)

    return { variations, dailyChart, ranking }
  }, [dataInicial, dataFinal, combustivel.faturamento, automotivos.faturamento, conveniencia.faturamento, global.faturamento, global.lucroBruto])

  const pctOfTotal = (v: number): number => (global.faturamento > 0 ? (v / global.faturamento) * 100 : 0)

  const maxRankFat = Math.max(...data.ranking.map((p) => p.faturamento))
  const maxRankLbr = Math.max(...data.ranking.map((p) => Math.abs(p.lucroBruto)))

  const handlePostoClick = (codigo: number) => {
    setEmpresas([codigo])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-4xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Globe className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-violet-700 dark:text-violet-300">Global · Rede inteira</DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-xs">
                <CalendarRange className="h-3.5 w-3.5" />
                {fmtPeriod(dataInicial, dataFinal)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SegmentKpiMini label="Faturamento total" value={formatCurrencyInt(global.faturamento)} variation={data.variations.faturamento} />
            <SegmentKpiMini label="Lucro bruto total" value={formatCurrencyInt(global.lucroBruto)} variation={data.variations.lucro} />
            <SegmentKpiMini label="Margem geral" value={fmtPct(global.margem)} variation={data.variations.margem} />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <SegmentMini
              label="Combustível"
              Icon={Droplets}
              cardBg="bg-blue-50/60 dark:bg-blue-950/20"
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              faturamento={combustivel.faturamento}
              lucroBruto={combustivel.lucroBruto}
              margem={combustivel.margem}
              shareOfTotal={pctOfTotal(combustivel.faturamento)}
            />
            <SegmentMini
              label="Automotivos"
              Icon={Wrench}
              cardBg="bg-amber-50/60 dark:bg-amber-950/20"
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              faturamento={automotivos.faturamento}
              lucroBruto={automotivos.lucroBruto}
              margem={automotivos.margem}
              shareOfTotal={pctOfTotal(automotivos.faturamento)}
            />
            <SegmentMini
              label="Conveniência"
              Icon={Store}
              cardBg="bg-emerald-50/60 dark:bg-emerald-950/20"
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              faturamento={conveniencia.faturamento}
              lucroBruto={conveniencia.lucroBruto}
              margem={conveniencia.margem}
              shareOfTotal={pctOfTotal(conveniencia.faturamento)}
            />
          </div>

          {data.dailyChart.length >= 2 && (
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Faturamento diário por segmento
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.dailyChart} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
                <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} width={62} />
                <Tooltip
                  formatter={((v: number, name: string) => [formatCurrencyTooltip(v), name]) as never}
                  labelFormatter={((label: string, payload: { payload?: { data?: string } }[]) => payload?.[0]?.payload?.data?.split('-').reverse().join('/') ?? label) as never}
                  contentStyle={{ fontSize: 12, ...ct.tooltip }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} verticalAlign="top" height={20} />
                <Line type="monotone" dataKey="Combustível" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="Automotivos" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="Conveniência" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Ranking de postos · clique para filtrar
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-3 py-1.5 text-left">Posto</th>
                  <th className="px-2 py-1.5 text-right">Faturamento</th>
                  <th className="px-2 py-1.5 text-right">Lucro bruto</th>
                  <th className="px-3 py-1.5 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((posto) => (
                  <tr
                    key={posto.codigo}
                    onClick={() => handlePostoClick(posto.codigo)}
                    className="cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 hover:bg-violet-50/50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-violet-900/10"
                  >
                    <td className="px-3 py-1.5 text-left font-medium">{posto.nome}</td>
                    <td className="px-2 py-1">
                      <BarCell value={posto.faturamento} max={maxRankFat} formatted={formatCurrencyInt(posto.faturamento)} color="blue" align="near" />
                    </td>
                    <td className="px-2 py-1">
                      <BarCell
                        value={Math.abs(posto.lucroBruto)}
                        max={maxRankLbr}
                        formatted={formatCurrencyInt(posto.lucroBruto)}
                        color={posto.lucroBruto < 0 ? 'red' : 'green'}
                        align="near"
                      />
                    </td>
                    <td className={cn('px-3 py-1.5 text-right tabular-nums', posto.margem < 0 && 'text-red-700 dark:text-red-400')}>
                      {fmtPct(posto.margem)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SegmentMiniProps {
  label: string
  Icon: typeof Droplets
  cardBg: string
  iconBg: string
  iconColor: string
  faturamento: number
  lucroBruto: number
  margem: number
  shareOfTotal: number
}

const SegmentMini = ({ label, Icon, cardBg, iconBg, iconColor, faturamento, lucroBruto, margem, shareOfTotal }: SegmentMiniProps) => (
  <div className={cn('rounded-lg border border-gray-200 p-3 dark:border-gray-700', cardBg)}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
      <div>
        <p className="text-gray-500 dark:text-gray-400">Faturamento</p>
        <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(faturamento)}</p>
      </div>
      <div>
        <p className="text-gray-500 dark:text-gray-400">Lucro bruto</p>
        <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(lucroBruto)}</p>
      </div>
      <div>
        <p className="text-gray-500 dark:text-gray-400">Margem</p>
        <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtPct(margem)}</p>
      </div>
      <div>
        <p className="text-gray-500 dark:text-gray-400">% do total</p>
        <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtPct(shareOfTotal)}</p>
      </div>
    </div>
  </div>
)

export default GlobalDetailModal
