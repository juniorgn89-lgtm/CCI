import { useMemo, useState } from 'react'
import { Fuel } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { formatCurrency, formatDate, formatLiters } from '@/lib/formatters'
import type {
  DailyRow,
  AbastecimentoRow,
  ProjectionMeta,
} from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface ProjectedDailyRow extends DailyRow {
  projecaoLitros: number
}

interface DiariaProps {
  data: DailyRow[]
  rows: AbastecimentoRow[]
  combustiveis: string[]
  projection: ProjectionMeta
}

const baseColumns: Column<ProjectedDailyRow>[] = [
  { key: 'data', label: 'Data', sortable: true, render: (row) => formatDate(row.data) },
  { key: 'abastecimentos', label: 'Abast.', align: 'right', sortable: true, render: (row) => new Intl.NumberFormat('pt-BR').format(row.abastecimentos) },
  { key: 'litros', label: 'Litros', align: 'right', sortable: true, render: (row) => formatLiters(row.litros) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (row) => formatCurrency(row.faturamento) },
  { key: 'custo', label: 'Custo', align: 'right', sortable: true, render: (row) => formatCurrency(row.custo) },
  { key: 'lucroBruto', label: 'Lucro bruto', align: 'right', sortable: true, render: (row) => formatCurrency(row.lucroBruto) },
  {
    key: 'margemPct', label: 'Margem', align: 'right', sortable: true,
    render: (row) => <HeatmapCell value={row.margemPct} min={-10} max={30} formatted={`${row.margemPct.toFixed(1)}%`} />,
  },
  { key: 'ticketMedio', label: 'Ticket médio', align: 'right', sortable: true, render: (row) => formatCurrency(row.ticketMedio) },
  {
    key: 'projecaoLitros',
    label: 'Projeção mês',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className="tabular-nums text-blue-700 dark:text-blue-400" title="Projeção do total do período se cada dia mantivesse esse volume">
        {formatLiters(row.projecaoLitros)}
      </span>
    ),
  },
]

const Diaria = ({ data, rows, combustiveis, projection }: DiariaProps) => {
  const [selectedFuel, setSelectedFuel] = useState('')

  const filteredData = useMemo<ProjectedDailyRow[]>(() => {
    // Default desc: dia mais recente primeiro
    const withProjection = (rows: DailyRow[]): ProjectedDailyRow[] =>
      rows.map((r) => ({
        ...r,
        projecaoLitros: r.litros * projection.daysTotal,
      }))

    if (!selectedFuel) {
      return withProjection([...data].sort((a, b) => b.data.localeCompare(a.data)))
    }

    const filtered = rows.filter((r) => r.combustivelNome === selectedFuel)
    const byDay = new Map<string, { litros: number; fat: number; custo: number; count: number }>()
    for (const r of filtered) {
      const day = r.dataHora.split('T')[0]
      const prev = byDay.get(day) ?? { litros: 0, fat: 0, custo: 0, count: 0 }
      byDay.set(day, {
        litros: prev.litros + r.litros,
        fat: prev.fat + r.valorTotal,
        custo: prev.custo + r.precoCusto * r.litros,
        count: prev.count + 1,
      })
    }

    const aggregated = Array.from(byDay.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dia, v]): DailyRow => {
        const lb = v.fat - v.custo
        return {
          data: dia,
          litros: v.litros,
          faturamento: v.fat,
          custo: v.custo,
          lucroBruto: lb,
          margemPct: v.fat > 0 ? (lb / v.fat) * 100 : 0,
          abastecimentos: v.count,
          ticketMedio: v.count > 0 ? v.fat / v.count : 0,
        }
      })

    return withProjection(aggregated)
  }, [data, rows, selectedFuel, projection.daysTotal])

  const totals = useMemo(() => {
    const t = filteredData.reduce(
      (acc, r) => ({
        abastecimentos: acc.abastecimentos + r.abastecimentos,
        litros: acc.litros + r.litros,
        faturamento: acc.faturamento + r.faturamento,
        custo: acc.custo + r.custo,
        lucroBruto: acc.lucroBruto + r.lucroBruto,
      }),
      { abastecimentos: 0, litros: 0, faturamento: 0, custo: 0, lucroBruto: 0 }
    )
    const margemPct = t.faturamento > 0 ? (t.lucroBruto / t.faturamento) * 100 : 0
    return { ...t, margemPct }
  }, [filteredData])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Resumo diário</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedFuel ? `Filtrado por ${selectedFuel}` : 'Agregado por dia no período selecionado'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Fuel className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedFuel}
              onChange={(e) => setSelectedFuel(e.target.value)}
              className="h-8 appearance-none rounded-lg border border-gray-200 bg-white pl-8 pr-8 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500"
            >
              <option value="">Todos combustíveis</option>
              {combustiveis.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {filteredData.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Abastecimentos:{' '}
            <span className="font-medium tabular-nums">
              {new Intl.NumberFormat('pt-BR').format(totals.abastecimentos)}
            </span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
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
          <span
            className="text-[13px] font-medium"
            style={{ color: totals.margemPct >= 0 ? '#166534' : '#991b1b' }}
          >
            Margem:{' '}
            <span className="tabular-nums">{totals.margemPct.toFixed(1)}%</span>
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
      <DataTable columns={baseColumns} data={filteredData} keyExtractor={(row) => row.data} enableRowHighlight />
    </div>
  )
}

export default Diaria
