import { useState } from 'react'
import {
  ArrowUpRight, ArrowDownRight, Droplets, DollarSign, Fuel, Receipt,
  Calendar, CalendarDays, Lightbulb, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import type { ComparativoData } from '@/pages/Inteligencia/hooks/usePostoComparativo'

interface Props {
  data: ComparativoData
}

const VariacaoBadge = ({ value }: { value: number }) => {
  if (value === 0) return null
  const positive = value > 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
      positive ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
    )}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  )
}

const metrics = [
  { key: 'receita' as const, label: 'Receita', icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', format: formatCurrency },
  { key: 'litros' as const, label: 'Litros', icon: Droplets, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', format: formatLiters },
  { key: 'abastecimentos' as const, label: 'Abastecimentos', icon: Fuel, color: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30', format: (v: number) => formatNumber(v) },
  { key: 'ticketMedio' as const, label: 'Ticket Médio', icon: Receipt, color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', format: formatCurrency },
]

const PostoComparativo = ({ data }: Props) => {
  // Linha destacada — útil pra fixar visualmente uma métrica ao analisar variações
  const [selected, setSelected] = useState<string | null>(null)
  const toggleSelected = (key: string) => {
    setSelected((curr) => (curr === key ? null : key))
  }
  // Auto insights
  const insights: { type: 'positive' | 'warning' | 'info'; text: string }[] = []

  if (data.variacaoMes.receita !== 0) {
    insights.push({
      type: data.variacaoMes.receita >= 0 ? 'positive' : 'warning',
      text: `Receita ${data.variacaoMes.receita >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(data.variacaoMes.receita).toFixed(2)}% vs mês anterior`,
    })
  }

  if (data.variacaoAno.receita !== 0) {
    insights.push({
      type: data.variacaoAno.receita >= 0 ? 'positive' : 'warning',
      text: `Receita ${data.variacaoAno.receita >= 0 ? 'subiu' : 'caiu'} ${Math.abs(data.variacaoAno.receita).toFixed(2)}% vs mesmo período do ano anterior`,
    })
  }

  if (data.variacaoMes.abastecimentos !== 0) {
    insights.push({
      type: data.variacaoMes.abastecimentos >= 0 ? 'positive' : 'warning',
      text: `Volume de abastecimentos ${data.variacaoMes.abastecimentos >= 0 ? 'cresceu' : 'caiu'} ${Math.abs(data.variacaoMes.abastecimentos).toFixed(2)}% vs mês anterior`,
    })
  }

  if (data.variacaoMes.ticketMedio !== 0) {
    insights.push({
      type: data.variacaoMes.ticketMedio >= 0 ? 'info' : 'warning',
      text: `Ticket médio ${data.variacaoMes.ticketMedio >= 0 ? 'subiu' : 'caiu'} ${Math.abs(data.variacaoMes.ticketMedio).toFixed(2)}% vs mês anterior`,
    })
  }

  const order = { positive: 0, info: 1, warning: 2 }
  insights.sort((a, b) => order[a.type] - order[b.type])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800/30 dark:bg-purple-900/10">
        <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
          Comparativo temporal — <span className="font-bold">{data.postoNome}</span>
        </p>
        <p className="mt-0.5 text-xs text-purple-600/70 dark:text-purple-500/70">
          Analisando o desempenho do posto em relação ao mês anterior e ao mesmo período do ano anterior
        </p>
      </div>

      {/* Comparison table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Métrica</th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-end gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {data.anoAnterior.label}
                  </div>
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-end gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {data.mesAnterior.label}
                  </div>
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-end gap-1">
                    <Calendar className="h-3 w-3" />
                    {data.atual.label}
                  </div>
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">vs Mês</th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">vs Ano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {metrics.map((m) => {
                const Icon = m.icon
                const rowSelected = selected === m.key
                return (
                  <tr
                    key={m.key}
                    onClick={() => toggleSelected(m.key)}
                    aria-selected={rowSelected}
                    className={cn(
                      'cursor-pointer transition-colors',
                      rowSelected
                        ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                        : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', m.bg)}>
                          <Icon className={cn('h-4 w-4', m.color)} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-400 dark:text-gray-500">
                      {m.format(data.anoAnterior[m.key])}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {m.format(data.mesAnterior[m.key])}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                      {m.format(data.atual[m.key])}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <VariacaoBadge value={data.variacaoMes[m.key]} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <VariacaoBadge value={data.variacaoAno[m.key]} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Análise do Período</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2',
                  ins.type === 'positive' && 'border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10',
                  ins.type === 'warning' && 'border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10',
                  ins.type === 'info' && 'border-blue-200 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-900/10',
                )}
              >
                {ins.type === 'positive' && <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />}
                {ins.type === 'warning' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                {ins.type === 'info' && <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
                <p className="text-xs text-gray-700 dark:text-gray-300">{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PostoComparativo
