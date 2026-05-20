import { useMemo, useState } from 'react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import BarCell from '@/components/tables/BarCell'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { CatalogProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface ParetoAnalysisProps {
  products: CatalogProduct[]
}

interface ParetoRow {
  produtoCodigo: number
  nome: string
  faturamento: number
  participacao: number
  lucroBruto: number
  margemPct: number
  precoMedio: number
  custoMedio: number
  lbMedio: number
  [key: string]: unknown
}

const THRESHOLDS = [60, 70, 80, 90] as const

/** Grid 10×10 preenchido de baixo pra cima na proporção `pct`. */
const DotGrid = ({ pct, color }: { pct: number; color: string }) => {
  const filled = Math.round(Math.min(100, Math.max(0, pct)))
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 100 }).map((_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: i >= 100 - filled ? color : '#e5e7eb' }}
        />
      ))}
    </div>
  )
}

const buildCols = (maxFat: number, maxLB: number): Column<ParetoRow>[] => [
  { key: 'nome', label: 'Produto', sortable: true },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => <BarCell value={r.faturamento} max={maxFat} formatted={formatCurrency(r.faturamento)} color="blue" /> },
  { key: 'participacao', label: 'Participação', align: 'right', sortable: true, render: (r) => `${r.participacao.toFixed(2)}%` },
  { key: 'lucroBruto', label: 'Lucro Bruto', align: 'right', sortable: true, render: (r) => <BarCell value={r.lucroBruto} max={maxLB} formatted={formatCurrency(r.lucroBruto)} color="green" /> },
  { key: 'margemPct', label: 'Margem', align: 'right', sortable: true, render: (r) => `${r.margemPct.toFixed(2)}%` },
  { key: 'precoMedio', label: 'Preço Médio', align: 'right', sortable: true, render: (r) => formatCurrency(r.precoMedio) },
  { key: 'custoMedio', label: 'Custo Médio', align: 'right', sortable: true, render: (r) => formatCurrency(r.custoMedio) },
  { key: 'lbMedio', label: 'L.B. Médio', align: 'right', sortable: true, render: (r) => formatCurrency(r.lbMedio) },
]

const ParetoAnalysis = ({ products }: ParetoAnalysisProps) => {
  const [threshold, setThreshold] = useState<number>(60)

  const data = useMemo(() => {
    const vendidos = products.filter((p) => p.faturamento > 0)
    const totalFat = vendidos.reduce((s, p) => s + p.faturamento, 0)
    const sorted = [...vendidos].sort((a, b) => b.faturamento - a.faturamento)

    const limite = (threshold / 100) * totalFat
    const rows: ParetoRow[] = []
    let acumulado = 0
    for (const p of sorted) {
      if (acumulado >= limite && rows.length > 0) break
      const lucroBruto = p.faturamento - p.custoMedio * p.qtdVendida
      rows.push({
        produtoCodigo: p.produtoCodigo,
        nome: p.nome,
        faturamento: p.faturamento,
        participacao: totalFat > 0 ? (p.faturamento / totalFat) * 100 : 0,
        lucroBruto,
        margemPct: p.margemPct,
        precoMedio: p.precoMedioVenda,
        custoMedio: p.custoMedio,
        lbMedio: p.precoMedioVenda - p.custoMedio,
      })
      acumulado += p.faturamento
    }

    const pctProdutos = vendidos.length > 0 ? (rows.length / vendidos.length) * 100 : 0
    const pctFat = totalFat > 0 ? (acumulado / totalFat) * 100 : 0
    return { rows, totalVendidos: vendidos.length, paretoFat: acumulado, pctProdutos, pctFat }
  }, [products, threshold])

  const cols = useMemo(() => {
    const maxFat = data.rows.reduce((m, r) => Math.max(m, r.faturamento), 0)
    const maxLB = data.rows.reduce((m, r) => Math.max(m, r.lucroBruto), 0)
    return buildCols(maxFat, maxLB)
  }, [data.rows])

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-6">
        {/* Threshold + texto */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
            {THRESHOLDS.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  threshold === t
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                {t}%
              </button>
            ))}
          </div>
          <p className="max-w-md text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <span className="font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.rows.length)} produtos</span>, de{' '}
            <span className="font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.totalVendidos)} vendidos</span> no mês,
            representam até <span className="font-bold text-gray-900 dark:text-gray-100">{threshold}%</span> do faturamento,
            totalizando <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(data.paretoFat)}</span>.
          </p>
        </div>

        {/* Dot grids */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <DotGrid pct={data.pctProdutos} color="#2563eb" />
            <div>
              <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{Math.round(data.pctProdutos)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">dos produtos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DotGrid pct={data.pctFat} color="#1e3a5f" />
            <div>
              <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{Math.round(data.pctFat)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">do faturamento</p>
            </div>
          </div>
        </div>
      </div>

      <div className="-mx-6 overflow-auto px-6">
        <DataTable columns={cols} data={data.rows} keyExtractor={(r) => r.produtoCodigo} />
      </div>
    </div>
  )
}

export default ParetoAnalysis
