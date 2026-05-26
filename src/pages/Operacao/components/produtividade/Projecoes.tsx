import { useEffect, useMemo, useRef, useState } from 'react'
import { HelpCircle, TrendingUp, X } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatLiters } from '@/lib/formatters'
import { useMetasStore } from '@/store/metas'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
}

const LINE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const MAX_SELECTED = 6

const addDays = (yyyymmdd: string, n: number): string => {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const formatBrDate = (yyyymmdd: string): string => {
  if (!yyyymmdd || yyyymmdd.length < 10) return ''
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}/${m}/${y}`
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

interface ChartRow {
  data: string
  dataLabel: string
  isFuture: boolean
  // dados por frentista
  [key: string]: string | number | boolean | null | undefined
}

interface VisibleFrentista {
  codigo: number
  nome: string
  color: string
  meta: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
  label?: string
  visibleFrentistas: VisibleFrentista[]
}

const CustomTooltip = ({ active, payload, visibleFrentistas }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  if (!row) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1.5 font-semibold text-gray-700 dark:text-gray-200">
        {formatBrDate(row.data)}
        {row.isFuture && <span className="ml-1.5 font-normal text-blue-500">(projeção)</span>}
      </p>
      <div className="space-y-1">
        {visibleFrentistas.map((f) => {
          const cum = (row.isFuture ? row[`f${f.codigo}_proj`] : row[`f${f.codigo}_real`]) as number | null
          const daily = row[`f${f.codigo}_daily`] as number | null
          if (cum == null) return null
          const pctMeta = f.meta > 0 ? (cum / f.meta) * 100 : null
          return (
            <div key={f.codigo} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 dark:text-gray-100">{f.nome}</p>
                <p className="text-[11px] tabular-nums text-gray-500">
                  Acumulado: <span className="font-medium text-gray-700 dark:text-gray-300">{formatLiters(cum)}</span>
                  {row.isFuture && <span className="ml-1 text-blue-500">(projeção)</span>}
                </p>
                {daily != null && daily > 0 && (
                  <p className="text-[11px] tabular-nums text-gray-500">
                    No dia: {formatLiters(daily)}
                  </p>
                )}
                {pctMeta != null && (
                  <p className="text-[11px] tabular-nums text-gray-500">
                    Meta atingida: <span className={cn('font-medium', pctMeta >= 100 ? 'text-green-600' : 'text-amber-600')}>{pctMeta.toFixed(1)}%</span>
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Projecoes = ({ frentistas, periodInfo }: Props) => {
  const { manualMode, metas: manualMetas } = useMetasStore()
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  // Linha destacada na tabela "Projeção por Frentista" — útil pra comparar projeções
  const [selectedFrentista, setSelectedFrentista] = useState<number | null>(null)
  const toggleSelectedFrentista = (codigo: number) => {
    setSelectedFrentista((curr) => (curr === codigo ? null : codigo))
  }

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

  // Cor estável por frentista — ordem em validFrentistas (que é sort por litros desc)
  const colorByCodigo = useMemo(() => {
    const m = new Map<number, string>()
    validFrentistas.forEach((f, i) => m.set(f.funcionarioCodigo, LINE_COLORS[i % LINE_COLORS.length]))
    return m
  }, [validFrentistas])

  // Seleção dos frentistas visíveis no gráfico (default: top 5)
  const [selectedCodigos, setSelectedCodigos] = useState<Set<number>>(
    () => new Set(validFrentistas.slice(0, 5).map((f) => f.funcionarioCodigo))
  )

  // Sincroniza seleção quando a lista de frentistas muda. Padrão "store info
  // from previous renders" — compara identidade da lista pra detectar mudança.
  const [prevFrentistasRef, setPrevFrentistasRef] = useState(validFrentistas)
  if (prevFrentistasRef !== validFrentistas) {
    setPrevFrentistasRef(validFrentistas)
    setSelectedCodigos(new Set(validFrentistas.slice(0, 5).map((f) => f.funcionarioCodigo)))
  }

  // Toast inline para limite de 6
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 2500)
    return () => clearTimeout(t)
  }, [toastMsg])

  // Expansão da lista de pills (default: mostra só top 6)
  const [pillsExpanded, setPillsExpanded] = useState(false)
  const PILLS_VISIBLE = 6

  const toggleFrentista = (codigo: number) => {
    setSelectedCodigos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        next.delete(codigo)
        return next
      }
      if (next.size >= MAX_SELECTED) {
        setToastMsg(`Máximo de ${MAX_SELECTED} frentistas para comparação`)
        return prev
      }
      next.add(codigo)
      return next
    })
  }

  // Tabela de projeção (continua usando todos os válidos)
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

  // Frentistas visíveis no gráfico (em ordem da seleção / ranking)
  const visibleFrentistas: VisibleFrentista[] = useMemo(
    () =>
      validFrentistas
        .filter((f) => selectedCodigos.has(f.funcionarioCodigo))
        .map((f) => ({
          codigo: f.funcionarioCodigo,
          nome: f.nome,
          color: colorByCodigo.get(f.funcionarioCodigo) ?? '#9ca3af',
          meta: manualMode ? manualMetas[f.funcionarioCodigo] ?? 0 : f.prevLitros,
        })),
    [validFrentistas, selectedCodigos, colorByCodigo, manualMode, manualMetas]
  )

  // Dados do gráfico: cumulativo real + projeção + daily por frentista
  const { chartData, todayLabel } = useMemo(() => {
    const { dataInicial, dataFinal, todayStr } = periodInfo
    if (!dataInicial || !dataFinal) return { chartData: [] as ChartRow[], todayLabel: null as string | null }

    const allDays: string[] = []
    let cursor = dataInicial
    for (let i = 0; i < 1100 && cursor <= dataFinal; i++) {
      allDays.push(cursor)
      cursor = addDays(cursor, 1)
    }

    // Por frentista visível: mapa diário + média dos últimos 7 dias para projeção
    const seriesPerFrentista = visibleFrentistas.map((vf) => {
      const f = validFrentistas.find((x) => x.funcionarioCodigo === vf.codigo)
      if (!f) return { codigo: vf.codigo, dailyMap: new Map<string, number>(), avg: 0 }
      const dailyMap = new Map(f.dailyLitros.map((d) => [d.data, d.litros]))
      const last7 = f.dailyLitros.slice(-7)
      const avg = last7.length > 0 ? last7.reduce((s, d) => s + d.litros, 0) / last7.length : 0
      return { codigo: vf.codigo, dailyMap, avg }
    })

    // Acumuladores por frentista
    const cumReal = new Map<number, number>()
    const cumProj = new Map<number, number>()
    seriesPerFrentista.forEach((s) => {
      cumReal.set(s.codigo, 0)
      cumProj.set(s.codigo, 0)
    })

    const data: ChartRow[] = allDays.map((day) => {
      const isPast = day < todayStr
      const isToday = day === todayStr
      const isFuture = day > todayStr
      const row: ChartRow = {
        data: day,
        dataLabel: day.split('-').slice(1).reverse().join('/'),
        isFuture,
      }
      seriesPerFrentista.forEach((s) => {
        const dayLitros = s.dailyMap.get(day) ?? 0
        if (isPast || isToday) {
          const newCum = (cumReal.get(s.codigo) ?? 0) + dayLitros
          cumReal.set(s.codigo, newCum)
          row[`f${s.codigo}_real`] = newCum
          row[`f${s.codigo}_daily`] = dayLitros
          if (isToday) {
            cumProj.set(s.codigo, newCum)
            row[`f${s.codigo}_proj`] = newCum
          }
        } else {
          // futuro: projeta com a média
          const newProj = (cumProj.get(s.codigo) ?? cumReal.get(s.codigo) ?? 0) + s.avg
          cumProj.set(s.codigo, newProj)
          row[`f${s.codigo}_proj`] = newProj
          row[`f${s.codigo}_daily`] = s.avg
        }
      })
      return row
    })

    const todayItem = data.find((r) => r.data === todayStr)
    const tLabel = (todayItem?.dataLabel as string) ?? null
    return { chartData: data, todayLabel: tLabel }
  }, [visibleFrentistas, validFrentistas, periodInfo])

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

      {/* LineChart de evolução acumulada com seleção dinâmica */}
      <div className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Evolução Acumulada por Frentista
          </h3>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {visibleFrentistas.length}/{MAX_SELECTED} selecionados
          </span>
        </div>

        {/* Seletor de pills com ranking — mostra top 6 + toggle "mais" */}
        {validFrentistas.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(pillsExpanded ? validFrentistas : validFrentistas.slice(0, PILLS_VISIBLE)).map((f, idx) => {
              const rank = idx + 1
              const isSelected = selectedCodigos.has(f.funcionarioCodigo)
              const color = colorByCodigo.get(f.funcionarioCodigo) ?? '#9ca3af'
              return (
                <button
                  key={f.funcionarioCodigo}
                  onClick={() => toggleFrentista(f.funcionarioCodigo)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
                    isSelected
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  )}
                  style={isSelected ? { backgroundColor: color } : undefined}
                  title={`${rank}º em litros bombeados no período`}
                >
                  <span style={{ fontWeight: 600 }}>{rank}</span> {f.nome}
                </button>
              )
            })}

            {/* Badge "+ N mais" / "▴ menos" */}
            {validFrentistas.length > PILLS_VISIBLE && (
              <button
                onClick={() => setPillsExpanded((v) => !v)}
                className="cursor-pointer rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-gray-600 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                style={{ fontSize: '12px' }}
              >
                {pillsExpanded
                  ? '▴ menos'
                  : `+ ${validFrentistas.length - PILLS_VISIBLE} mais`}
              </button>
            )}
          </div>
        )}

        {chartData.length === 0 || visibleFrentistas.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
            {visibleFrentistas.length === 0 ? 'Selecione ao menos um frentista para ver o gráfico.' : 'Sem dados para projetar.'}
          </div>
        ) : (
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
              <Tooltip content={<CustomTooltip visibleFrentistas={visibleFrentistas} />} />
              {visibleFrentistas.map((f) => (
                <Line
                  key={`${f.codigo}-real`}
                  type="monotone"
                  dataKey={`f${f.codigo}_real`}
                  name={f.nome}
                  stroke={f.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              {visibleFrentistas.map((f) => (
                <Line
                  key={`${f.codigo}-proj`}
                  type="monotone"
                  dataKey={`f${f.codigo}_proj`}
                  name={`${f.nome} (projeção)`}
                  stroke={f.color}
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
        )}

        {/* Toast inline */}
        {toastMsg && (
          <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 shadow-md dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
            <span>{toastMsg}</span>
            <button
              onClick={() => setToastMsg(null)}
              className="text-amber-600 hover:text-amber-800"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
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
                tableRows.map((f, idx) => {
                  const rowSelected = selectedFrentista === f.funcionarioCodigo
                  return (
                  <tr
                    key={f.funcionarioCodigo}
                    onClick={() => toggleSelectedFrentista(f.funcionarioCodigo)}
                    aria-selected={rowSelected}
                    className={cn(
                      'cursor-pointer transition-colors',
                      rowSelected
                        ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                        : cn('hover:bg-gray-50 dark:hover:bg-gray-800/40', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30'),
                    )}
                  >
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Projecoes
