import { useEffect, useMemo, useRef, useState } from 'react'
import { HelpCircle, TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatLiters } from '@/lib/formatters'
import { useMetasStore } from '@/store/metas'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
}

const LINE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const addDays = (yyyymmdd: string, n: number): string => {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Filtra registros sintéticos / inválidos (sem nome, codigo zerado, fallback numérico)
const isValidFrentista = (nome: string | null | undefined): boolean => {
  if (!nome) return false
  const t = nome.trim()
  if (t === '') return false
  if (t === 'Frentista 0') return false
  if (/^\d+$/.test(t)) return false
  return true
}

const Projecoes = ({ frentistas, periodInfo }: Props) => {
  const { manualMode, metas: manualMetas } = useMetasStore()
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!helpOpen) return
    const onClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [helpOpen])

  // Frentistas válidos (filtra placeholders sintéticos)
  const validFrentistas = useMemo(
    () => frentistas.filter((f) => isValidFrentista(f.nome)),
    [frentistas]
  )

  // Tabela de projeção
  const tableRows = useMemo(
    () =>
      validFrentistas.map((f) => {
        const last7 = f.dailyLitros.slice(-7)
        const avg = last7.length > 0 ? last7.reduce((s, d) => s + d.litros, 0) / last7.length : 0
        const projecao = avg * periodInfo.daysRemaining
        const totalEstimado = f.litros + projecao
        const meta = manualMode ? manualMetas[f.funcionarioCodigo] ?? 0 : f.prevLitros
        const vsMeta = meta > 0 ? totalEstimado - meta : 0
        const vsMetaPct = meta > 0 ? ((totalEstimado - meta) / meta) * 100 : 0
        return { ...f, avg, projecao, totalEstimado, meta, vsMeta, vsMetaPct }
      }),
    [validFrentistas, periodInfo.daysRemaining, manualMode, manualMetas]
  )

  // Top 5 frentistas para o gráfico (já filtrados)
  const top5 = useMemo(() => validFrentistas.slice(0, 5), [validFrentistas])

  // Dados do gráfico: cumulativo real + projeção
  const { chartData, todayLabel } = useMemo(() => {
    const { dataInicial, dataFinal, todayStr } = periodInfo
    if (!dataInicial || !dataFinal) return { chartData: [], todayLabel: null as string | null }

    const allDays: string[] = []
    let cursor = dataInicial
    for (let i = 0; i < 1100 && cursor <= dataFinal; i++) {
      allDays.push(cursor)
      cursor = addDays(cursor, 1)
    }

    const seriesPerFrentista = top5.map((f) => {
      const dailyMap = new Map(f.dailyLitros.map((d) => [d.data, d.litros]))
      const last7 = f.dailyLitros.slice(-7)
      const avg = last7.length > 0 ? last7.reduce((s, d) => s + d.litros, 0) / last7.length : 0

      let cumReal = 0
      let cumProj = 0
      return allDays.map((day) => {
        let real: number | null = null
        let proj: number | null = null
        if (day < todayStr) {
          cumReal += dailyMap.get(day) ?? 0
          real = cumReal
        } else if (day === todayStr) {
          cumReal += dailyMap.get(day) ?? 0
          real = cumReal
          cumProj = cumReal
          proj = cumProj
        } else {
          cumProj += avg
          proj = cumProj
        }
        return { real, proj }
      })
    })

    const data = allDays.map((day, idx) => {
      const row: Record<string, number | string | null> = {
        dataLabel: day.split('-').slice(1).reverse().join('/'),
      }
      top5.forEach((_, fIdx) => {
        const point = seriesPerFrentista[fIdx][idx]
        row[`f${fIdx}_real`] = point.real
        row[`f${fIdx}_proj`] = point.proj
      })
      return row
    })

    const todayItem = data.find((_, i) => allDays[i] === todayStr)
    const tLabel = todayItem ? (todayItem.dataLabel as string) : null

    return { chartData: data, todayLabel: tLabel }
  }, [top5, periodInfo])

  return (
    <div className="space-y-5">
      {/* Badge explicativo + popover */}
      <div className="flex items-center gap-2">
        <div className="relative inline-flex items-center gap-1.5" ref={helpRef}>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
            Projeção baseada nos últimos 7 dias × dias restantes
          </span>
          <button
            onClick={() => setHelpOpen((v) => !v)}
            aria-label="Sobre a projeção"
            aria-expanded={helpOpen}
            className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          {helpOpen && (
            <div
              role="tooltip"
              className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              A projeção é calculada com base na média dos últimos 7 dias de operação, multiplicada pelos dias restantes do mês. Não considera sazonalidade ou eventos futuros.
            </div>
          )}
        </div>
        {periodInfo.daysRemaining > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {periodInfo.daysRemaining} dia{periodInfo.daysRemaining > 1 ? 's' : ''} restante{periodInfo.daysRemaining > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabela de projeção */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projeção por Frentista</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Realizado</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Projeção (+{periodInfo.daysRemaining}d)
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Total estimado</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">vs. Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                    Sem dados de frentistas no período.
                  </td>
                </tr>
              ) : (
                tableRows.map((f, idx) => (
                  <tr key={f.funcionarioCodigo} className={cn(idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                    <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{f.nome}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                      {formatLiters(f.litros)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-blue-600 dark:text-blue-400">
                      +{formatLiters(f.projecao)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatLiters(f.totalEstimado)}
                    </td>
                    <td className={cn(
                      'px-4 py-2.5 text-right text-sm font-medium tabular-nums',
                      f.meta === 0 || f.vsMetaPct > 150
                        ? 'text-gray-400'
                        : f.vsMeta >= 0 ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}>
                      {f.meta === 0 || f.vsMetaPct > 150
                        ? 'Novo'
                        : `${f.vsMeta >= 0 ? '+' : ''}${formatLiters(f.vsMeta)} (${f.vsMetaPct >= 0 ? '+' : ''}${f.vsMetaPct.toFixed(1)}%)`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LineChart de evolução acumulada (top 5) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Evolução Acumulada — Top 5 Frentistas
          </h3>
        </div>

        {chartData.length === 0 || top5.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
            Sem dados para projetar.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="dataLabel"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k L`}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={((v: number) => [formatLiters(v), '']) as never}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="line"
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                {top5.map((f, i) => (
                  <Line
                    key={`${f.funcionarioCodigo}-real`}
                    type="monotone"
                    dataKey={`f${i}_real`}
                    name={f.nome}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                {top5.map((f, i) => (
                  <Line
                    key={`${f.funcionarioCodigo}-proj`}
                    type="monotone"
                    dataKey={`f${i}_proj`}
                    name={`${f.nome} (projeção)`}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                    legendType="none"
                  />
                ))}
                {todayLabel && (
                  <ReferenceLine
                    x={todayLabel}
                    stroke="#9ca3af"
                    strokeDasharray="2 2"
                    label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: '#6b7280' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  )
}

export default Projecoes
