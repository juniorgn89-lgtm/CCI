import { useMemo } from 'react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { FuelTypeRow, ProjectionMeta } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface ProjectedFuelTypeRow extends FuelTypeRow {
  projecaoLitros: number
  projecaoFaturamento: number
  projecaoLucroBruto: number
}

interface TipoProps {
  data: FuelTypeRow[]
  projection: ProjectionMeta
}

const ParticipationBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="h-2 w-20 rounded-full bg-gray-100 dark:bg-gray-700">
      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
    <span className="text-xs tabular-nums">{value.toFixed(1)}%</span>
  </div>
)

const columns: Column<ProjectedFuelTypeRow>[] = [
  { key: 'produtoCodigo', label: 'Código', sortable: true, render: (row) => (
    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{row.produtoCodigo}</span>
  )},
  { key: 'nome', label: 'Combustível', sortable: true },
  { key: 'litros', label: 'Litros', align: 'right', sortable: true, render: (row) => formatLiters(row.litros) },
  { key: 'participacao', label: 'Participação', align: 'right', sortable: true, render: (row) => <ParticipationBar value={row.participacao} /> },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (row) => formatCurrency(row.faturamento) },
  { key: 'lucroBruto', label: 'Lucro bruto', align: 'right', sortable: true, render: (row) => (
    <span className={cn('font-medium', row.lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
      {formatCurrency(row.lucroBruto)}
    </span>
  )},
  { key: 'precoMedioVenda', label: 'Preço venda', align: 'right', sortable: true, render: (row) => formatCurrency(row.precoMedioVenda) },
  { key: 'precoCustoMedio', label: 'Preço custo', align: 'right', sortable: true, render: (row) => formatCurrency(row.precoCustoMedio) },
  { key: 'lbPorLitro', label: 'L.B./Litro', align: 'right', sortable: true, render: (row) => formatCurrency(row.lbPorLitro) },
  {
    key: 'margem', label: 'Margem', align: 'right', sortable: true,
    render: (row) => <HeatmapCell value={row.margem} min={-10} max={30} formatted={`${row.margem.toFixed(1)}%`} />,
  },
  {
    key: 'projecaoLitros',
    label: 'Projeção',
    align: 'right',
    sortable: true,
    render: (row) => (
      <div className="text-blue-700 dark:text-blue-400" title="Projeção do total no fim do período mantendo o ritmo atual">
        <p className="tabular-nums font-medium">{formatLiters(row.projecaoLitros)}</p>
        <p className="tabular-nums text-[10px] opacity-80">{formatCurrency(row.projecaoFaturamento)}</p>
      </div>
    ),
  },
]

const Tipo = ({ data, projection }: TipoProps) => {
  const projectedData = useMemo<ProjectedFuelTypeRow[]>(
    () => data.map((r) => ({
      ...r,
      projecaoLitros: r.litros * projection.scaleFactor,
      projecaoFaturamento: r.faturamento * projection.scaleFactor,
      projecaoLucroBruto: r.lucroBruto * projection.scaleFactor,
    })),
    [data, projection.scaleFactor]
  )

  const totals = useMemo(() => {
    const t = data.reduce(
      (acc, r) => ({
        litros: acc.litros + r.litros,
        faturamento: acc.faturamento + r.faturamento,
        custo: acc.custo + r.custo,
        lucroBruto: acc.lucroBruto + r.lucroBruto,
      }),
      { litros: 0, faturamento: 0, custo: 0, lucroBruto: 0 }
    )
    const lbPorLitro = t.litros > 0 ? t.lucroBruto / t.litros : 0
    const margem = t.faturamento > 0 ? (t.lucroBruto / t.faturamento) * 100 : 0
    return { ...t, lbPorLitro, margem }
  }, [data])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Por tipo de combustível</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detalhamento por produto com participação e margens</p>
        </div>
      </div>
      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Litros:{' '}
            <span className="font-medium tabular-nums">{formatLiters(totals.litros)}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Faturamento:{' '}
            <span className="font-medium tabular-nums">{formatCurrency(totals.faturamento)}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span
            className="text-[13px] font-medium"
            style={{ color: totals.lucroBruto >= 0 ? '#166534' : '#991b1b' }}
          >
            Lucro:{' '}
            <span className="tabular-nums">{formatCurrency(totals.lucroBruto)}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            L.B./Litro:{' '}
            <span className="font-medium tabular-nums">{formatCurrency(totals.lbPorLitro)}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span
            className="text-[13px] font-medium"
            style={{ color: totals.margem >= 0 ? '#166534' : '#991b1b' }}
          >
            Margem:{' '}
            <span className="tabular-nums">{totals.margem.toFixed(1)}%</span>
          </span>
          {projection.isProjectable && (
            <>
              <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
              <span className="text-[13px] font-medium text-blue-700 dark:text-blue-400">
                Projeção mês:{' '}
                <span className="tabular-nums">
                  {formatLiters(totals.litros * projection.scaleFactor)}
                </span>
              </span>
            </>
          )}
        </div>
      )}
      <DataTable columns={columns} data={projectedData} keyExtractor={(row) => row.nome} enableRowHighlight />
    </div>
  )
}

export default Tipo
