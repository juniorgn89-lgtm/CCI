import { useState, useMemo } from 'react'
import { Trophy, BarChart3, TrendingUp, Activity, LineChart } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import RankingFrentistas from '@/pages/Operacao/components/produtividade/RankingFrentistas'
import IndicadoresProdutividade from '@/pages/Operacao/components/produtividade/IndicadoresProdutividade'
import ConversaoProdutos from '@/pages/Operacao/components/produtividade/ConversaoProdutos'
import PerformanceAtendimento from '@/pages/Operacao/components/produtividade/PerformanceAtendimento'
import AnaliseTendencia from '@/pages/Operacao/components/produtividade/AnaliseTendencia'
import type { FrentistaRow, AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import type { RankingRow } from '@/pages/Operacao/hooks/useProductivityData'

/* ── Exported types ─────────────────────────────────────── */

export interface MergedFrentista {
  [key: string]: unknown
  posicao: number
  funcionarioCodigo: number
  nome: string
  litrosVendidos: number
  atendimentos: number
  faturamento: number
  ticketMedio: number
  mediaLitrosPorAtendimento: number
  totalVendasPlacar: number
  quantidadeVendasPlacar: number
  taxaConversao: number
}

export interface DailyTrend {
  data: string
  dataFormatada: string
  litros: number
  atendimentos: number
  faturamento: number
}

/* ── Sub-tab config ─────────────────────────────────────── */

type SubTab = 'ranking' | 'indicadores' | 'conversao' | 'performance' | 'tendencia'

const subTabs: { key: SubTab; label: string; icon: typeof Trophy }[] = [
  { key: 'ranking', label: 'Ranking', icon: Trophy },
  { key: 'indicadores', label: 'Indicadores', icon: BarChart3 },
  { key: 'conversao', label: 'Conversão', icon: TrendingUp },
  { key: 'performance', label: 'Performance', icon: Activity },
  { key: 'tendencia', label: 'Tendência', icon: LineChart },
]

/* ── Props ──────────────────────────────────────────────── */

interface ProdutividadeTabProps {
  frentistaRows: FrentistaRow[]
  abastecimentoRows: AbastecimentoRow[]
  conversionRanking: RankingRow[]
  isLoading: boolean
}

/* ── Skeleton ───────────────────────────────────────────── */

const ProdSkeleton = () => (
  <div className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-6 w-24" />
        </div>
      ))}
    </div>
  </div>
)

/* ── Component ──────────────────────────────────────────── */

const ProdutividadeTab = ({ frentistaRows, abastecimentoRows, conversionRanking, isLoading }: ProdutividadeTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('ranking')

  // Merge frentistaRows (from abastecimentos) with conversion data (from PLACARES)
  const mergedData = useMemo((): MergedFrentista[] => {
    const convMap = new Map<number, RankingRow>()
    for (const r of conversionRanking) {
      convMap.set(r.funcionarioCodigo, r)
    }

    return frentistaRows.map((f, i) => {
      const placar = convMap.get(f.funcionarioCodigo)
      return {
        posicao: i + 1,
        funcionarioCodigo: f.funcionarioCodigo,
        nome: f.nome,
        litrosVendidos: f.litrosVendidos,
        atendimentos: f.atendimentos,
        faturamento: f.faturamento,
        ticketMedio: f.ticketMedio,
        mediaLitrosPorAtendimento: f.atendimentos > 0 ? f.litrosVendidos / f.atendimentos : 0,
        totalVendasPlacar: placar?.totalVendas ?? 0,
        quantidadeVendasPlacar: placar?.quantidadeVendas ?? 0,
        taxaConversao: placar?.taxaConversao ?? 0,
      }
    })
  }, [frentistaRows, conversionRanking])

  // Compute daily trends from abastecimento rows
  const dailyTrends = useMemo((): DailyTrend[] => {
    const dayMap = new Map<string, { litros: number; count: number; valor: number }>()

    for (const a of abastecimentoRows) {
      // Extract date from dataHora (format: "yyyy-MM-dd HH:mm:ss" or "yyyy-MM-dd")
      const dateStr = a.dataHora?.substring(0, 10)
      if (!dateStr || dateStr.length < 10) continue

      const prev = dayMap.get(dateStr) ?? { litros: 0, count: 0, valor: 0 }
      dayMap.set(dateStr, {
        litros: prev.litros + a.litros,
        count: prev.count + 1,
        valor: prev.valor + a.valorTotal,
      })
    }

    return Array.from(dayMap.entries())
      .map(([date, agg]) => {
        const [, month, day] = date.split('-')
        return {
          data: date,
          dataFormatada: `${day}/${month}`,
          litros: agg.litros,
          atendimentos: agg.count,
          faturamento: agg.valor,
        }
      })
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [abastecimentoRows])

  if (isLoading) return <ProdSkeleton />

  return (
    <div className="space-y-5">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {subTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                activeSubTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'ranking' && <RankingFrentistas data={mergedData} />}
      {activeSubTab === 'indicadores' && <IndicadoresProdutividade data={mergedData} />}
      {activeSubTab === 'conversao' && <ConversaoProdutos conversionRanking={conversionRanking} />}
      {activeSubTab === 'performance' && <PerformanceAtendimento data={mergedData} />}
      {activeSubTab === 'tendencia' && <AnaliseTendencia trends={dailyTrends} />}
    </div>
  )
}

export default ProdutividadeTab
