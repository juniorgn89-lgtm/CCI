import { useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyShort, formatCurrencyTooltip } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type {
  LbLitroData,
  LbLitroProduct,
  ProjectionMeta,
} from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface ProjectedLbLitroProduct extends LbLitroProduct {
  projecaoLucroBruto: number
  projecaoLitros: number
}

interface LbLitroProps {
  data: LbLitroData
  projection: ProjectionMeta
}

const formatDay = (date: string) => {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}

const formatMonth = (mes: string) => {
  const [y, m] = mes.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[Number(m) - 1]}/${y.slice(2)}`
}

const fmtBrl = (v: number) => formatCurrency(v)

const VariationBadge = ({ current, previous }: { current: number; previous: number }) => {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const isPositive = pct > 0
  const isNeutral = Math.abs(pct) < 0.5
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown

  return (
    <div className={cn(
      'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
      isNeutral ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        : isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    )}>
      <Icon className="h-3 w-3" />
      {isNeutral ? '0,0%' : `${isPositive ? '+' : ''}${pct.toFixed(1)}%`}
      <span className="font-normal text-gray-500 dark:text-gray-400">vs mês anterior</span>
    </div>
  )
}

const tableColumns: Column<ProjectedLbLitroProduct>[] = [
  {
    key: 'nome',
    label: 'Combustível',
    sortable: true,
    render: (row) => <span className="font-medium text-gray-900 dark:text-gray-100">{row.nome}</span>,
  },
  {
    key: 'lbPorLitro',
    label: 'L.B./Litro',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={cn(
        'font-bold tabular-nums',
        row.lbPorLitro >= 0.5 ? 'text-green-600 dark:text-green-400'
          : row.lbPorLitro >= 0 ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400'
      )}>
        {fmtBrl(row.lbPorLitro)}
      </span>
    ),
  },
  {
    key: 'lucroBruto',
    label: 'Lucro bruto',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={cn('font-medium tabular-nums', row.lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {fmtBrl(row.lucroBruto)}
      </span>
    ),
  },
  {
    key: 'litros',
    label: 'Litros',
    align: 'right',
    sortable: true,
    render: (row) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(row.litros),
  },
  {
    key: 'participacaoLb',
    label: 'Particip. L.B.',
    align: 'right',
    sortable: true,
    render: (row) => <HeatmapCell value={row.participacaoLb} min={0} max={60} formatted={`${row.participacaoLb.toFixed(1)}%`} />,
  },
  {
    key: 'projecaoLucroBruto',
    label: 'Projeção L.B.',
    align: 'right',
    sortable: true,
    render: (row) => (
      <div className="text-blue-700 dark:text-blue-400" title="Projeção do lucro bruto no fim do período mantendo o ritmo atual">
        <p className="tabular-nums font-medium">{fmtBrl(row.projecaoLucroBruto)}</p>
        <p className="tabular-nums text-[10px] opacity-80">
          {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(row.projecaoLitros)} L
        </p>
      </div>
    ),
  },
]

const csvColumns: ExportColumn<ProjectedLbLitroProduct>[] = [
  { header: 'Combustível', accessor: (r) => r.nome },
  { header: 'L.B./Litro', accessor: (r) => r.lbPorLitro },
  { header: 'Lucro Bruto', accessor: (r) => r.lucroBruto },
  { header: 'Litros', accessor: (r) => r.litros },
  { header: 'Participação L.B. %', accessor: (r) => r.participacaoLb },
  { header: 'Projeção Lucro Bruto', accessor: (r) => r.projecaoLucroBruto },
  { header: 'Projeção Litros', accessor: (r) => r.projecaoLitros },
]

const LbLitro = ({ data, projection }: LbLitroProps) => {
  const projectedByProduct = useMemo<ProjectedLbLitroProduct[]>(
    () => data.byProduct.map((r) => ({
      ...r,
      projecaoLucroBruto: r.lucroBruto * projection.scaleFactor,
      projecaoLitros: r.litros * projection.scaleFactor,
    })),
    [data.byProduct, projection.scaleFactor]
  )

  const handleExport = useCallback(() => {
    exportToCsv('abastecimentos-lb-litro', projectedByProduct, csvColumns)
  }, [projectedByProduct])

  const best = data.byProduct.length > 0 ? data.byProduct[0] : null
  const worst = data.byProduct.length > 1 ? data.byProduct[data.byProduct.length - 1] : null

  const dailyChartData = useMemo(() =>
    data.daily.map((d) => ({
      ...d,
      lbPorLitroChart: Number(d.lbPorLitro.toFixed(4)),
      lbPorLitroRealChart: d.lbPorLitroReal !== null ? Number(d.lbPorLitroReal.toFixed(4)) : null,
      lbPorLitroProjetadoChart: d.lbPorLitroProjetado !== null ? Number(d.lbPorLitroProjetado.toFixed(4)) : null,
    }))
  , [data.daily])

  const hasProjection = useMemo(
    () => data.daily.some((d) => d.isProjected),
    [data.daily],
  )

  const dailyTotals = useMemo(() => {
    let litrosRealizados = 0
    let litrosProjetados = 0
    for (const d of data.daily) {
      if (d.litrosReal !== null) litrosRealizados += d.litrosReal
      if (d.isProjected && d.litrosProjetado !== null) litrosProjetados += d.litrosProjetado
    }
    return {
      realizados: litrosRealizados,
      projetados: litrosProjetados,
      total: litrosRealizados + litrosProjetados,
    }
  }, [data.daily])

  const fmtLitrosShort = (v: number): string => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M L`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k L`
    return `${v.toFixed(0)} L`
  }

  const productTotals = useMemo(() => {
    const t = data.byProduct.reduce(
      (acc, r) => ({
        litros: acc.litros + r.litros,
        lucroBruto: acc.lucroBruto + r.lucroBruto,
      }),
      { litros: 0, lucroBruto: 0 }
    )
    const lbPorLitro = t.litros > 0 ? t.lucroBruto / t.litros : 0
    return { ...t, lbPorLitro }
  }, [data.byProduct])

  const monthlyChartData = useMemo(() =>
    data.monthly.map((m) => ({
      ...m,
      mesLabel: formatMonth(m.mes),
      lbPorLitroChart: Number(m.lbPorLitro.toFixed(4)),
    }))
  , [data.monthly])

  const hasMonthlyProjection = useMemo(
    () => data.monthly.some((m) => m.isCurrentMonth && m.lucroBrutoProjetadoExtra > 0),
    [data.monthly],
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">L.B. por litro no período</p>
            <p className={cn(
              'mt-1 text-3xl font-bold tabular-nums',
              data.global >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'
            )}>
              {fmtBrl(data.global)}
            </p>
            <div className="mt-2">
              <VariationBadge current={data.global} previous={data.prevMonthGlobal} />
            </div>
          </div>

          <div className="flex gap-6">
            {best && (
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Melhor produto</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{best.nome}</p>
                <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{fmtBrl(best.lbPorLitro)}</p>
              </div>
            )}
            {worst && worst.nome !== best?.nome && (
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Menor L.B./L</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{worst.nome}</p>
                <p className={cn(
                  'text-lg font-bold tabular-nums',
                  worst.lbPorLitro >= 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {fmtBrl(worst.lbPorLitro)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {dailyChartData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">L.B./Litro dia a dia</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Lucro bruto por litro e volume diário
                {hasProjection && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    · projeção dos dias futuros baseada na média dos últimos 7 dias
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Já vendidos: <span className="tabular-nums">{fmtLitrosShort(dailyTotals.realizados)}</span>
              </span>
              {hasProjection && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400">
                  Projeção do período: <span className="tabular-nums">{fmtLitrosShort(dailyTotals.total)}</span>
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={dailyChartData}>
              <defs>
                <linearGradient id="gradLb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLbProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis
                dataKey="data"
                tickFormatter={formatDay}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                interval={dailyChartData.length > 15 ? Math.floor(dailyChartData.length / 10) : 0}
              />
              <YAxis
                yAxisId="litros"
                orientation="right"
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="lb"
                orientation="left"
                tickFormatter={(v: number) => `R$${v.toFixed(2)}`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={(props: { active?: boolean; label?: string | number; payload?: ReadonlyArray<{ name?: string; value?: number | null; color?: string }> }) => {
                  if (!props.active || !props.payload?.length) return null
                  const hasRealLb = props.payload.some((p) => p.name === 'L.B./Litro' && p.value != null)
                  const items = props.payload.filter((p) => {
                    if (p.value == null) return false
                    if (p.name === 'L.B./Litro (projeção)' && hasRealLb) return false
                    return true
                  })
                  if (items.length === 0) return null
                  const labelStr = String(props.label ?? '')
                  const [y, m, d] = labelStr.split('-')
                  // Hoje (dia em andamento) → marca o valor como parcial
                  const now = new Date()
                  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                  const isToday = labelStr === todayStr
                  return (
                    <div className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900">
                      <p className="mb-1 flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-200">
                        {`${d}/${m}/${y}`}
                        {isToday && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            parcial · em andamento
                          </span>
                        )}
                      </p>
                      {items.map((p, i) => {
                        const isLitros = p.name?.startsWith('Litros')
                        const formatted = isLitros
                          ? `${(p.value as number).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`
                          : formatCurrencyTooltip(p.value as number)
                        return (
                          <p key={i} className="flex items-center gap-1.5 tabular-nums">
                            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                            <span className="text-gray-600 dark:text-gray-300">{p.name}:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatted}</span>
                          </p>
                        )
                      })}
                    </div>
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                yAxisId="lb"
                y={data.global}
                stroke="#6b7280"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: `Média: ${fmtBrl(data.global)}`, position: 'insideTopLeft', fontSize: 10, fill: '#6b7280' }}
              />
              <Bar
                yAxisId="litros"
                dataKey="litrosReal"
                name="Litros"
                fill={CHART_COLORS[3]}
                fillOpacity={0.4}
                radius={[3, 3, 0, 0]}
              />
              {hasProjection && (
                <Bar
                  yAxisId="litros"
                  dataKey="litrosProjetado"
                  name="Litros (projeção)"
                  fill={CHART_COLORS[3]}
                  fillOpacity={0.15}
                  stroke={CHART_COLORS[3]}
                  strokeOpacity={0.4}
                  strokeDasharray="3 3"
                  radius={[3, 3, 0, 0]}
                />
              )}
              <Area
                yAxisId="lb"
                type="monotone"
                dataKey="lbPorLitroRealChart"
                name="L.B./Litro"
                stroke="#10b981"
                fill="url(#gradLb)"
                strokeWidth={2.5}
                connectNulls={false}
                dot={dailyChartData.length <= 15 ? { r: 3, fill: '#10b981' } : false}
              />
              {hasProjection && (
                <Area
                  yAxisId="lb"
                  type="monotone"
                  dataKey="lbPorLitroProjetadoChart"
                  name="L.B./Litro (projeção)"
                  stroke="#10b981"
                  strokeOpacity={0.6}
                  strokeDasharray="5 5"
                  fill="url(#gradLbProj)"
                  strokeWidth={2}
                  connectNulls={false}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {monthlyChartData.length > 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Evolução mensal do L.B./Litro</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Últimos 12 meses de lucro bruto por litro
              {hasMonthlyProjection && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  · mês corrente com projeção do total no fim do período
                </span>
              )}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis
                dataKey="mesLabel"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="lb"
                tickFormatter={(v: number) => `R$${v.toFixed(2)}`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="litros"
                orientation="right"
                tickFormatter={formatCurrencyShort}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((value: number, name: string) => [formatCurrencyTooltip(value), name]) as never}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="litros"
                dataKey="lucroBrutoReal"
                name="Lucro bruto"
                stackId="lb"
                fill={CHART_COLORS[0]}
                fillOpacity={0.6}
                radius={[0, 0, 0, 0]}
              />
              {hasMonthlyProjection && (
                <Bar
                  yAxisId="litros"
                  dataKey="lucroBrutoProjetadoExtra"
                  name="Projeção (até fim do mês)"
                  stackId="lb"
                  fill={CHART_COLORS[0]}
                  fillOpacity={0.2}
                  stroke={CHART_COLORS[0]}
                  strokeOpacity={0.4}
                  strokeDasharray="3 3"
                  radius={[4, 4, 0, 0]}
                />
              )}
              <Line
                yAxisId="lb"
                type="monotone"
                dataKey="lbPorLitroChart"
                name="L.B./Litro"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">L.B./Litro por combustível</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data.byProduct.length} combustíveis — ordenados por L.B./Litro
            </p>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
        {data.byProduct.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-gray-400">Nenhum dado encontrado no período.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
              <span className="text-[13px] text-gray-700 dark:text-gray-300">
                Litros:{' '}
                <span className="font-medium tabular-nums">
                  {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(productTotals.litros)}
                </span>
              </span>
              <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
              <span
                className="text-[13px] font-medium"
                style={{ color: productTotals.lucroBruto >= 0 ? '#166534' : '#991b1b' }}
              >
                Lucro bruto:{' '}
                <span className="tabular-nums">{fmtBrl(productTotals.lucroBruto)}</span>
              </span>
              <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
              <span
                className="text-[13px] font-medium"
                style={{
                  color: productTotals.lbPorLitro >= 0.5 ? '#166534'
                    : productTotals.lbPorLitro >= 0 ? '#a16207'
                    : '#991b1b',
                }}
              >
                L.B./Litro global:{' '}
                <span className="tabular-nums">{fmtBrl(productTotals.lbPorLitro)}</span>
              </span>
              {projection.isProjectable && (
                <>
                  <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-[13px] font-medium text-blue-700 dark:text-blue-400">
                    Projeção L.B. mês:{' '}
                    <span className="tabular-nums">
                      {fmtBrl(productTotals.lucroBruto * projection.scaleFactor)}
                    </span>
                  </span>
                </>
              )}
            </div>
            <DataTable
              columns={tableColumns}
              data={projectedByProduct}
              keyExtractor={(row) => row.nome}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default LbLitro
