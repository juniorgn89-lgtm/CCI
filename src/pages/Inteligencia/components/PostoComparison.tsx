import { useMemo, useState } from 'react'
import { Trophy, TrendingUp, Fuel, Receipt, Target, Medal } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { cn } from '@/lib/utils'
import type { PostoData } from '../hooks/useNetworkData'

interface Props {
  postos: PostoData[]
  networkAvg: {
    receita: number
    litros: number
    abastecimentos: number
    ticketMedio: number
    conversao: number
  }
}

const fmt = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `R$ ${(v / 1_000).toFixed(1)}K`
      : `R$ ${v.toFixed(2)}`

const fmtNum = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `${(v / 1_000).toFixed(1)}K`
      : v.toFixed(0)

const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']
const medalBorders = ['border-yellow-400', 'border-gray-300', 'border-amber-500']

type ChartView = 'litros' | 'receita' | 'evolucao'

const PostoComparison = ({ postos, networkAvg }: Props) => {
  const [chartView, setChartView] = useState<ChartView>('litros')

  const barData = useMemo(() =>
    postos.map(p => ({
      name: p.fantasia.length > 15 ? p.fantasia.slice(0, 15) + '…' : p.fantasia,
      litros: Math.round(p.litros),
      receita: Math.round(p.receita),
      ticketMedio: Math.round(p.ticketMedio * 100) / 100,
      conversao: Math.round(p.conversao * 10) / 10,
    })),
    [postos]
  )

  const scoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-emerald-600'
    if (score >= 60) return 'from-blue-500 to-blue-600'
    if (score >= 40) return 'from-yellow-500 to-yellow-600'
    return 'from-red-500 to-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Ranking cards - Top 3 */}
      {postos.length >= 1 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {postos.slice(0, 3).map((posto, i) => (
            <div
              key={posto.empresaCodigo}
              className={cn(
                'relative overflow-hidden rounded-xl border-2 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900',
                medalBorders[i] ?? 'border-gray-200 dark:border-gray-700'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', i === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30' : i === 1 ? 'bg-gray-100 dark:bg-gray-800' : 'bg-amber-100 dark:bg-amber-900/30')}>
                    <Medal className={cn('h-5 w-5', medalColors[i])} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{i + 1}º Lugar</p>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{posto.fantasia}</h3>
                    <p className="text-xs text-gray-400">{posto.cidade}/{posto.estado}</p>
                  </div>
                </div>
                {/* Score badge */}
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white font-bold text-lg', scoreGradient(posto.score))}>
                  {posto.score}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Receita</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmt(posto.receita)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Litros</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmtNum(posto.litros)}L</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ticket Médio</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmt(posto.ticketMedio)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Conversão</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{posto.conversao.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full ranking table */}
      {postos.length > 3 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ranking Completo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Posto</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Score</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Receita</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Litros</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Abastecimentos</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Ticket Médio</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {postos.map((p, i) => (
                  <tr key={p.empresaCodigo} className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      {i < 3 ? (
                        <Medal className={cn('h-5 w-5', medalColors[i])} />
                      ) : (
                        <span className="text-gray-400">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{p.fantasia}</p>
                        <p className="text-xs text-gray-400">{p.cidade}/{p.estado}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white',
                        `bg-gradient-to-r ${scoreGradient(p.score)}`
                      )}>
                        {p.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(p.receita)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{fmtNum(p.litros)}L</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{fmtNum(p.abastecimentos)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{fmt(p.ticketMedio)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.conversao.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparative charts */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Gráficos Comparativos</h3>
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {([
              { key: 'litros' as const, label: 'Litros', icon: Fuel },
              { key: 'receita' as const, label: 'Receita', icon: Receipt },
              { key: 'evolucao' as const, label: 'Score', icon: TrendingUp },
            ]).map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setChartView(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    chartView === tab.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={350}>
            {chartView === 'evolucao' ? (
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => [`${v} pts`, 'Score']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="conversao" name="Conversão %" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            ) : (
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => chartView === 'receita' ? fmt(v) : fmtNum(v)} />
                <Tooltip
                  formatter={(v: number) => [chartView === 'receita' ? fmt(v) : `${fmtNum(v)}L`, chartView === 'receita' ? 'Receita' : 'Litros']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey={chartView} fill={chartView === 'receita' ? '#2563eb' : '#10b981'} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Network averages summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: 'Receita Média', value: fmt(networkAvg.receita), icon: Receipt },
          { label: 'Litros Médios', value: `${fmtNum(networkAvg.litros)}L`, icon: Fuel },
          { label: 'Abast. Médio', value: fmtNum(networkAvg.abastecimentos), icon: Target },
          { label: 'Ticket Médio', value: fmt(networkAvg.ticketMedio), icon: TrendingUp },
          { label: 'Conversão Média', value: `${networkAvg.conversao.toFixed(1)}%`, icon: Trophy },
        ].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PostoComparison
