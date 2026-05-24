import { useMemo, useState } from 'react'
import { LineChart as LineChartIcon, CalendarRange, TrendingUp, TrendingDown, Calendar, Target } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import BarCell from '@/components/tables/BarCell'
import { buildDateRange, generateDailyEvolution } from './segmentMockHelpers'

interface SetorLinha {
  setor: 'Combustível' | 'Automotivos' | 'Conveniência'
  realizadoFaturamento: number
  projetadoFaturamento: number
  realizadoLucro: number
  projetadoLucro: number
  margemProjetada: number
}

interface ProjecaoDetailModalProps {
  open: boolean
  onClose: () => void
  dataInicial: string
  dataFinal: string
  setores: SetorLinha[]
}

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

const fmtPeriod = (di: string, df: string): string => {
  const a = di.split('-').reverse().join('/')
  const b = df.split('-').reverse().join('/')
  return `${a} — ${b}`
}

const ProjecaoDetailModal = ({ open, onClose, dataInicial, dataFinal, setores }: ProjecaoDetailModalProps) => {
  // Linha destacada — útil pra comparar realizado/projetado entre setores
  const [selectedSetor, setSelectedSetor] = useState<string | null>(null)
  const toggleSelectedSetor = (setor: string) => {
    setSelectedSetor((curr) => (curr === setor ? null : setor))
  }
  const dates = useMemo(() => buildDateRange(dataInicial, dataFinal), [dataInicial, dataFinal])
  const periodLabel = useMemo(() => fmtPeriod(dataInicial, dataFinal), [dataInicial, dataFinal])

  // Dia "atual" pra dividir entre realizado e projetado no gráfico (mock: ~60% do período).
  const diasNoPeriodo = dates.length
  const diasDecorridos = Math.max(1, Math.round(diasNoPeriodo * 0.6))
  const diasRestantes = Math.max(0, diasNoPeriodo - diasDecorridos)

  const totais = useMemo(() => {
    const realizadoFaturamento = setores.reduce((s, x) => s + x.realizadoFaturamento, 0)
    const projetadoFaturamento = setores.reduce((s, x) => s + x.projetadoFaturamento, 0)
    const realizadoLucro = setores.reduce((s, x) => s + x.realizadoLucro, 0)
    const projetadoLucro = setores.reduce((s, x) => s + x.projetadoLucro, 0)
    const margemProjetada = projetadoFaturamento > 0 ? (projetadoLucro / projetadoFaturamento) * 100 : 0
    const variacaoFaturamento = realizadoFaturamento > 0
      ? ((projetadoFaturamento - realizadoFaturamento) / realizadoFaturamento) * 100
      : 0
    const variacaoLucro = realizadoLucro > 0
      ? ((projetadoLucro - realizadoLucro) / realizadoLucro) * 100
      : 0
    const pctAtingido = projetadoFaturamento > 0
      ? (realizadoFaturamento / projetadoFaturamento) * 100
      : 0
    return {
      realizadoFaturamento,
      projetadoFaturamento,
      realizadoLucro,
      projetadoLucro,
      margemProjetada,
      variacaoFaturamento,
      variacaoLucro,
      pctAtingido,
    }
  }, [setores])

  // Curva de faturamento diário — realizado até "hoje", projetado depois.
  const chartData = useMemo(() => {
    const realizadoDiario = generateDailyEvolution('projecao-realizado', dates, totais.realizadoFaturamento)
    const projetadoDiario = generateDailyEvolution('projecao-projetado', dates, totais.projetadoFaturamento)
    let realizadoAcum = 0
    let projetadoAcum = 0
    return dates.map((d, i) => {
      realizadoAcum += realizadoDiario[i]?.faturamento ?? 0
      projetadoAcum += projetadoDiario[i]?.faturamento ?? 0
      const isFuturo = i >= diasDecorridos
      return {
        date: d,
        dateLabel: d.slice(8, 10) + '/' + d.slice(5, 7),
        realizado: isFuturo ? null : realizadoAcum,
        projetado: projetadoAcum,
      }
    })
  }, [dates, totais.realizadoFaturamento, totais.projetadoFaturamento, diasDecorridos])

  const refDate = chartData[diasDecorridos - 1]?.date

  const maxFaturamento = setores.reduce((m, x) => Math.max(m, x.projetadoFaturamento), 0)
  const maxLucro = setores.reduce((m, x) => Math.max(m, x.projetadoLucro), 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <LineChartIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>Projeção · Fim do período</DialogTitle>
              <DialogDescription>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
                  <CalendarRange className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  <span className="tabular-nums">{periodLabel}</span>
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* KPIs principais — realizado, projetado, lucro, dias restantes */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Faturamento projetado
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrencyInt(totais.projetadoFaturamento)}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                {totais.variacaoFaturamento >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                )}
                <span className={cn(totais.variacaoFaturamento >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                  {totais.variacaoFaturamento >= 0 ? '+' : ''}{totais.variacaoFaturamento.toFixed(1).replace('.', ',')}% vs realizado
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Lucro bruto projetado
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrencyInt(totais.projetadoLucro)}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                {totais.variacaoLucro >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                )}
                <span className={cn(totais.variacaoLucro >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                  {totais.variacaoLucro >= 0 ? '+' : ''}{totais.variacaoLucro.toFixed(1).replace('.', ',')}% vs realizado
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                <Target className="h-3 w-3" /> Realizado / Projetado
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {fmtPct(totais.pctAtingido)}
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                {formatCurrencyShort(totais.realizadoFaturamento)} de {formatCurrencyShort(totais.projetadoFaturamento)}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Dias restantes
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {diasRestantes}
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                {diasDecorridos} de {diasNoPeriodo} dias decorridos
              </p>
            </div>
          </div>

          {/* Mini-chart — realizado (linha sólida) + projetado (linha tracejada) */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Faturamento acumulado (realizado + projetado)
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => formatCurrencyShort(v as number)}
                />
                <Tooltip
                  formatter={(v: number, name) => [formatCurrency(v), name === 'realizado' ? 'Realizado' : 'Projetado']}
                  labelFormatter={(label) => `Dia ${label}`}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => value === 'realizado' ? 'Realizado' : 'Projetado'}
                />
                {refDate && <ReferenceLine x={chartData[diasDecorridos - 1]?.dateLabel} stroke="#cbd5e1" strokeDasharray="2 4" label={{ value: 'Hoje', position: 'top', fontSize: 9, fill: '#64748b' }} />}
                <Line type="monotone" dataKey="realizado" stroke="#1e3a5f" strokeWidth={2} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="projetado" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Comparativo Realizado vs Projetado por setor */}
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Comparativo Realizado vs Projetado por setor
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left font-medium">Setor</th>
                  <th className="px-3 py-2 text-right font-medium">Fat. Realizado</th>
                  <th className="px-3 py-2 text-right font-medium">Fat. Projetado</th>
                  <th className="px-3 py-2 text-right font-medium">Lucro Projetado</th>
                  <th className="px-3 py-2 text-right font-medium">Margem Proj.</th>
                  <th className="px-3 py-2 text-right font-medium">% Atingido</th>
                </tr>
              </thead>
              <tbody>
                {setores.map((s) => {
                  const pct = s.projetadoFaturamento > 0
                    ? (s.realizadoFaturamento / s.projetadoFaturamento) * 100
                    : 0
                  const rowSelected = selectedSetor === s.setor
                  return (
                    <tr
                      key={s.setor}
                      onClick={() => toggleSelectedSetor(s.setor)}
                      aria-selected={rowSelected}
                      className={cn(
                        'cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 dark:border-gray-800 dark:text-gray-200',
                        rowSelected
                          ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                      )}
                    >
                      <td className="px-3 py-2 text-left font-medium">{s.setor}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrencyInt(s.realizadoFaturamento)}</td>
                      <td className="px-2 py-1.5">
                        <BarCell
                          value={s.projetadoFaturamento}
                          max={maxFaturamento}
                          formatted={formatCurrencyInt(s.projetadoFaturamento)}
                          color="blue"
                          align="near"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <BarCell
                          value={s.projetadoLucro}
                          max={maxLucro}
                          formatted={formatCurrencyInt(s.projetadoLucro)}
                          color="green"
                          align="near"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(s.margemProjetada)}</td>
                      <td className={cn('px-3 py-2 text-right text-xs font-semibold tabular-nums', pct >= 100 ? 'text-emerald-700 dark:text-emerald-400' : pct >= 60 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400')}>
                        {fmtPct(pct)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-bold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-3 py-2 text-left">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrencyInt(totais.realizadoFaturamento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(totais.projetadoFaturamento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(totais.projetadoLucro)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(totais.margemProjetada)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', totais.pctAtingido >= 100 ? 'text-emerald-700 dark:text-emerald-400' : totais.pctAtingido >= 60 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400')}>
                    {fmtPct(totais.pctAtingido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            <strong>Projeção</strong> = extrapolação linear do ritmo atual até o fim do período. Margem projetada usa
            o mix de produtos observado nos dias já realizados.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProjecaoDetailModal
