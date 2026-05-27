import { useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { ArrowDown, ArrowUp, Download, FileText, Printer } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useThemeStore } from '@/store/theme'
import { useFilterStore } from '@/store/filters'
import { formatDate, formatCurrencyShort, formatCurrencyTooltip, formatPercent } from '@/lib/formatters'
import { COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type { CashFlowRow, CashFlowTotals } from '@/pages/Financeiro/hooks/useFinanceData'

interface CashFlowChartProps {
  data: CashFlowRow[]
  totals?: CashFlowTotals
  prevTotals?: CashFlowTotals
}

type ChartView = 'fluxo' | 'acumulado'

const csvExportColumns: ExportColumn<CashFlowRow>[] = [
  { header: 'Data', accessor: (r) => r.data },
  { header: 'Entradas Realizadas', accessor: (r) => r.entradas },
  { header: 'Saídas Realizadas', accessor: (r) => r.saidas },
  { header: 'Entradas Previstas', accessor: (r) => r.entradasPrevistas },
  { header: 'Saídas Previstas', accessor: (r) => r.saidasPrevistas },
  { header: 'Saldo Diário', accessor: (r) => r.saldo },
  { header: 'Saldo Acumulado', accessor: (r) => r.saldoAcumulado },
]

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MIN_DAYS_FOR_LINE_CHART = 5

/**
 * Calcula a variação % entre o valor atual e o anterior.
 * Retorna null quando não há base para comparar (período anterior zerado).
 */
const computeVariation = (current: number, previous: number): number | null => {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

interface KpiCardProps {
  label: string
  value: number
  variation: number | null
  /** Quando true, queda é positiva (verde). Usado pro card de Saídas. */
  invertVariation?: boolean
  variant: 'positive' | 'negative' | 'neutral'
}

const KpiCard = ({ label, value, variation, invertVariation, variant }: KpiCardProps) => {
  const colorMap = {
    positive: {
      border: 'border-green-200 dark:border-green-800',
      bg: 'bg-green-50 dark:bg-green-900/20',
      labelText: 'text-green-600 dark:text-green-400',
      valueText: 'text-green-700 dark:text-green-300',
    },
    negative: {
      border: 'border-red-200 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-900/20',
      labelText: 'text-red-600 dark:text-red-400',
      valueText: 'text-red-700 dark:text-red-300',
    },
    neutral: {
      border: value >= 0 ? 'border-blue-200 dark:border-blue-800' : 'border-amber-200 dark:border-amber-800',
      bg: value >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
      labelText: value >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400',
      valueText: value >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300',
    },
  }
  const c = colorMap[variant]

  // Direção visual da variação. Pra Saídas: queda é melhor → invertVariation = true.
  const isFavorable =
    variation === null
      ? null
      : invertVariation
        ? variation < 0
        : variation > 0
  const isUnchanged = variation !== null && variation === 0

  return (
    <div className={cn('rounded-lg border px-4 py-3', c.border, c.bg)}>
      <p className={cn('text-xs font-medium', c.labelText)}>{label}</p>
      <p className={cn('mt-1 text-lg font-bold tabular-nums', c.valueText)}>
        {formatCurrencyShort(value)}
      </p>
      {variation !== null && !isUnchanged ? (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-[11px] font-medium tabular-nums',
            isFavorable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {variation > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {variation > 0 ? '+' : ''}
          {formatPercent(variation)} vs mês anterior
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">vs mês anterior: —</p>
      )}
    </div>
  )
}

const CashFlowChart = ({ data, totals, prevTotals }: CashFlowChartProps) => {
  const [view, setView] = useState<ChartView>('fluxo')
  const dark = useThemeStore((s) => s.dark)
  const { dataInicial, dataFinal } = useFilterStore()

  // Cores do gráfico que variam com o tema (recharts não lê classes Tailwind, então
  // o valor precisa vir via prop em runtime — `useThemeStore` já reage à mudança de tema).
  const gridStroke = dark ? '#374151' : '#e5e7eb'
  const tickColor = dark ? '#9ca3af' : '#6b7280'
  const tooltipBg = dark ? '#1f2937' : '#ffffff'
  const tooltipBorder = dark ? '#374151' : '#e5e7eb'
  const tooltipText = dark ? '#f3f4f6' : '#111827'

  const handleExportCsv = useCallback(() => {
    const filename = `fluxo-caixa-${dataInicial}-${dataFinal}`
    exportToCsv(filename, data, csvExportColumns)
  }, [data, dataInicial, dataFinal])

  // TODO(financeiro): trocar window.print() por geração real de PDF (jsPDF/html2canvas)
  // quando o projeto adotar uma lib de PDF. Hoje o app não tem nenhuma, então o print
  // do browser é o caminho mais simples e funcional.
  const handleExportPdf = useCallback(() => {
    window.print()
  }, [])

  // Totais — usa os valores vindos do hook quando disponíveis (já processados e
  // alinhados com a mesma lógica de classificação do período anterior). Cai no
  // cálculo local se não vierem.
  const totalEntradas = totals?.entradas ?? data.reduce((acc, d) => acc + d.entradas, 0)
  const totalSaidas = totals?.saidas ?? data.reduce((acc, d) => acc + d.saidas, 0)
  const saldoPeriodo = totals?.saldo ?? totalEntradas - totalSaidas

  const variationEntradas = prevTotals ? computeVariation(totalEntradas, prevTotals.entradas) : null
  const variationSaidas = prevTotals ? computeVariation(totalSaidas, prevTotals.saidas) : null
  const variationSaldo = prevTotals ? computeVariation(saldoPeriodo, prevTotals.saldo) : null

  const diasComMovimento = data.length

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum movimento encontrado para o período selecionado.</p>
      </div>
    )
  }

  const isShortPeriod = diasComMovimento < MIN_DAYS_FOR_LINE_CHART

  return (
    <div className="space-y-4">
      {/* Summary bar com KPIs + variação vs período anterior */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total Entradas"
          value={totalEntradas}
          variation={variationEntradas}
          variant="positive"
        />
        <KpiCard
          label="Total Saídas"
          value={totalSaidas}
          variation={variationSaidas}
          invertVariation
          variant="negative"
        />
        <KpiCard
          label="Saldo do Período"
          value={saldoPeriodo}
          variation={variationSaldo}
          variant="neutral"
        />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Fluxo de Caixa</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              {([
                { key: 'fluxo' as const, label: 'Diário' },
                { key: 'acumulado' as const, label: 'Acumulado' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setView(opt.key)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    view === opt.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Export dropdown — substitui o botão único anterior */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={handleExportCsv}>
                  <FileText className="h-4 w-4 text-gray-500" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportPdf}>
                  <Printer className="h-4 w-4 text-gray-500" />
                  Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Subtítulo contextual: aparece só no modo Acumulado */}
        {view === 'acumulado' && (
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Saldo acumulado desde {formatDate(dataInicial)}
          </p>
        )}
        {view === 'fluxo' && <div className="mb-4" />}

        {isShortPeriod ? (
          // Período curto: usa BarChart simples, uma barra por dia (entrada - saída).
          <>
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              Período muito curto ({diasComMovimento} {diasComMovimento === 1 ? 'dia' : 'dias'} com movimento) —
              exibindo barras diárias. Selecione ao menos {MIN_DAYS_FOR_LINE_CHART} dias para visualizar a tendência.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v: string) => formatDate(v)}
                  tick={{ fontSize: 11, fill: tickColor }}
                  stroke={tickColor}
                />
                <YAxis
                  tickFormatter={formatCurrencyShort}
                  tick={{ fontSize: 11, fill: tickColor }}
                  stroke={tickColor}
                />
                <Tooltip
                  formatter={((value: number, name: string) => [formatCurrencyTooltip(value), name]) as never}
                  labelFormatter={((label: string) => formatDate(label)) as never}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${tooltipBorder}`,
                    backgroundColor: tooltipBg,
                    color: tooltipText,
                  }}
                />
                <Legend />
                <ReferenceLine x={todayISO()} stroke={tickColor} strokeDasharray="4 4" />
                <Bar dataKey="entradas" name="Entradas realizadas" fill={COLORS.positive} stackId="pos" />
                <Bar dataKey="entradasPrevistas" name="Entradas previstas" fill={COLORS.positive} fillOpacity={0.35} stackId="pos" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas realizadas" fill={COLORS.negative} stackId="neg" />
                <Bar dataKey="saidasPrevistas" name="Saídas previstas" fill={COLORS.negative} fillOpacity={0.35} stackId="neg" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            {view === 'fluxo' ? (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v: string) => formatDate(v)}
                  tick={{ fontSize: 11, fill: tickColor }}
                  stroke={tickColor}
                />
                <YAxis
                  tickFormatter={formatCurrencyShort}
                  tick={{ fontSize: 11, fill: tickColor }}
                  stroke={tickColor}
                />
                <Tooltip
                  formatter={((value: number, name: string) => [formatCurrencyTooltip(value), name]) as never}
                  labelFormatter={((label: string) => formatDate(label)) as never}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${tooltipBorder}`,
                    backgroundColor: tooltipBg,
                    color: tooltipText,
                  }}
                />
                <Legend />
                {/* Linha vertical pontilhada marcando "hoje" — separa realizado de projeção */}
                <ReferenceLine
                  x={todayISO()}
                  stroke={tickColor}
                  strokeDasharray="4 4"
                  label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: tickColor }}
                />
                {/* Realizadas (stack=positive) com cor sólida */}
                <Bar
                  dataKey="entradas"
                  name="Entradas realizadas"
                  fill={COLORS.positive}
                  fillOpacity={0.85}
                  stackId="positivo"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="entradasPrevistas"
                  name="Entradas previstas"
                  fill={COLORS.positive}
                  fillOpacity={0.35}
                  stroke={COLORS.positive}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  stackId="positivo"
                  radius={[4, 4, 0, 0]}
                />
                {/* Realizadas (stack=negative) com cor sólida */}
                <Bar
                  dataKey="saidas"
                  name="Saídas realizadas"
                  fill={COLORS.negative}
                  fillOpacity={0.85}
                  stackId="negativo"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="saidasPrevistas"
                  name="Saídas previstas"
                  fill={COLORS.negative}
                  fillOpacity={0.35}
                  stroke={COLORS.negative}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  stackId="negativo"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="saldoAcumulado"
                  name="Saldo acumulado"
                  stroke={COLORS.accent}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v: string) => formatDate(v)}
                  tick={{ fontSize: 11, fill: tickColor }}
                  stroke={tickColor}
                />
                <YAxis
                  tickFormatter={formatCurrencyShort}
                  tick={{ fontSize: 11, fill: tickColor }}
                  stroke={tickColor}
                />
                <Tooltip
                  formatter={((value: number, name: string) => [formatCurrencyTooltip(value), name]) as never}
                  labelFormatter={((label: string) => formatDate(label)) as never}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${tooltipBorder}`,
                    backgroundColor: tooltipBg,
                    color: tooltipText,
                  }}
                />
                <Legend />
                <ReferenceLine
                  x={todayISO()}
                  stroke={tickColor}
                  strokeDasharray="4 4"
                  label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: tickColor }}
                />
                <Bar
                  dataKey="saldo"
                  name="Saldo Diário"
                  fill={COLORS.accent}
                  fillOpacity={0.3}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="saldoAcumulado"
                  name="Saldo Acumulado"
                  stroke={COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COLORS.primary }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default CashFlowChart
