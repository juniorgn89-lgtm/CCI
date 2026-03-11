import { useCallback, useMemo, useState } from 'react'
import { Fuel } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import ExportButton from '@/components/tables/ExportButton'
import { formatCurrency, formatDate, formatLiters } from '@/lib/formatters'
import exportToCsv, { type ExportColumn } from '@/lib/exportCsv'
import type { DailyRow, AbastecimentoRow } from '@/pages/Combustiveis/hooks/useFuelData'

interface DailyTableProps {
  data: DailyRow[]
  rows: AbastecimentoRow[]
  combustiveis: string[]
}

const columns: Column<DailyRow>[] = [
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
]

const csvColumns: ExportColumn<DailyRow>[] = [
  { header: 'Data', accessor: (r) => r.data },
  { header: 'Abastecimentos', accessor: (r) => r.abastecimentos },
  { header: 'Litros', accessor: (r) => r.litros },
  { header: 'Faturamento', accessor: (r) => r.faturamento },
  { header: 'Custo', accessor: (r) => r.custo },
  { header: 'Lucro Bruto', accessor: (r) => r.lucroBruto },
  { header: 'Margem %', accessor: (r) => r.margemPct },
  { header: 'Ticket Médio', accessor: (r) => r.ticketMedio },
]

const DailyTable = ({ data, rows, combustiveis }: DailyTableProps) => {
  const [selectedFuel, setSelectedFuel] = useState('')

  const filteredData = useMemo(() => {
    if (!selectedFuel) return data

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

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
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
  }, [data, rows, selectedFuel])

  const handleExport = useCallback(() => {
    exportToCsv(`combustiveis-diario${selectedFuel ? `-${selectedFuel}` : ''}`, filteredData, csvColumns)
  }, [filteredData, selectedFuel])

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
              <option value="">Todos combustiveis</option>
              {combustiveis.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
      </div>
      <DataTable columns={columns} data={filteredData} keyExtractor={(row) => row.data} />
    </div>
  )
}

export default DailyTable
