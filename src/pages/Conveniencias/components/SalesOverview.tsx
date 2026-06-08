import { useMemo, useState } from 'react'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import type { DailyRow, GroupRow, DaySaleProduct, CatalogProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'
import usePagamentosRaw from '@/pages/Conveniencias/hooks/useDiaPagamentos'
import VendaDetailModal from '@/pages/Conveniencias/components/VendaDetailModal'
import ParetoAnalysis from '@/pages/Conveniencias/components/ParetoAnalysis'
import CurvaABC from '@/pages/Conveniencias/components/CurvaABC'

interface SalesOverviewProps {
  dailyData: DailyRow[]
  groupTable: GroupRow[]
  /** Produtos vendidos por dia (yyyy-MM-dd → lista) — pro modal do dia. */
  salesByDay: Record<string, DaySaleProduct[]>
  /** Produtos por grupo (grupoCodigo → lista) — pro modal do grupo. */
  productsByGroup: Record<number, DaySaleProduct[]>
  /** Catálogo do período (produto × métricas) — pro Pareto / Curva ABC. */
  catalogProducts: CatalogProduct[]
}

type SubView = 'diario' | 'grupo' | 'pareto' | 'abc'

const dailyCols: Column<DailyRow>[] = [
  { key: 'data', label: 'Data', sortable: true, render: (r) => formatDate(r.data) },
  { key: 'qtdItens', label: 'Itens', align: 'right', sortable: true, render: (r) => formatNumber(r.qtdItens) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => formatCurrency(r.faturamento) },
  { key: 'custo', label: 'Custo', align: 'right', sortable: true, render: (r) => formatCurrency(r.custo) },
  { key: 'margemRs', label: 'Margem R$', align: 'right', sortable: true, render: (r) => formatCurrency(r.margemRs) },
  {
    key: 'margemPct', label: 'Margem %', align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.margemPct} min={-10} max={40} formatted={`${r.margemPct.toFixed(0)}%`} />,
  },
]

const groupCols: Column<GroupRow>[] = [
  { key: 'nome', label: 'Grupo', sortable: true },
  { key: 'quantidade', label: 'Qtd Vendida', align: 'right', sortable: true, render: (r) => formatNumber(r.quantidade) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => formatCurrency(r.faturamento) },
  { key: 'margemTotal', label: 'Margem R$', align: 'right', sortable: true, render: (r) => formatCurrency(r.margemTotal) },
  {
    key: 'margemPct', label: 'Margem %', align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.margemPct} min={-10} max={40} formatted={`${r.margemPct.toFixed(0)}%`} />,
  },
]

const SalesOverview = ({ dailyData, groupTable, salesByDay, productsByGroup, catalogProducts }: SalesOverviewProps) => {
  const [subView, setSubView] = useState<SubView>('diario')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<{ codigo: number; nome: string } | null>(null)

  const periodIni = useFilterStore((s) => s.dataInicial)
  const periodFim = useFilterStore((s) => s.dataFinal)

  // Modal do dia → só aquele dia; modal do grupo → período inteiro.
  const dayPag = usePagamentosRaw(selectedDay, selectedDay)
  const groupPag = usePagamentosRaw(selectedGroup ? periodIni : null, selectedGroup ? periodFim : null)

  const dayProducts = selectedDay ? (salesByDay[selectedDay] ?? []) : []
  const groupProducts = selectedGroup ? (productsByGroup[selectedGroup.codigo] ?? []) : []

  // Dia a Dia sempre começa decrescente (dia mais recente no topo).
  const dailyDesc = useMemo(
    () => [...dailyData].sort((a, b) => b.data.localeCompare(a.data)),
    [dailyData],
  )

  const subTabs: { key: SubView; label: string }[] = [
    { key: 'diario', label: 'Dia a Dia' },
    { key: 'grupo', label: 'Por Grupo' },
    { key: 'pareto', label: 'Análise de Pareto' },
    { key: 'abc', label: 'Curva ABC' },
  ]

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubView(tab.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
              subView === tab.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tables / chart */}
      {subView === 'diario' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Resumo diário</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Clique num dia pra ver os produtos vendidos</span>
          </div>
          <DataTable columns={dailyCols} data={dailyDesc} keyExtractor={(r) => r.data} onRowClick={(r) => setSelectedDay(r.data)} />
        </div>
      )}

      {subView === 'grupo' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Vendas por grupo</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Clique num grupo pra ver os produtos</span>
          </div>
          <DataTable columns={groupCols} data={groupTable} keyExtractor={(r) => r.grupoCodigo} onRowClick={(r) => setSelectedGroup({ codigo: r.grupoCodigo, nome: r.nome })} />
        </div>
      )}

      {subView === 'pareto' && <ParetoAnalysis products={catalogProducts} />}

      {subView === 'abc' && <CurvaABC products={catalogProducts} />}

      {/* Modal do dia — produtos vendidos no dia + pagamento rateado. */}
      <VendaDetailModal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={`Vendas de ${selectedDay ? formatDate(selectedDay) : ''}`}
        products={dayProducts}
        showGroupFilter
        itens={dayPag.itens}
        formas={dayPag.formas}
        pagLoading={dayPag.isLoading}
      />

      {/* Modal do grupo — produtos do grupo no período + pagamento rateado. */}
      <VendaDetailModal
        open={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title={`Grupo: ${selectedGroup?.nome ?? ''}`}
        products={groupProducts}
        itens={groupPag.itens}
        formas={groupPag.formas}
        pagLoading={groupPag.isLoading}
      />
    </div>
  )
}

export default SalesOverview
