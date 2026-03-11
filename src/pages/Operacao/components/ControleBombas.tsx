import { Fuel, Gauge } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatCurrency, formatCurrencyTooltip, formatNumber, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { BombaRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface ControleBombasProps {
  bombaRows: BombaRow[]
}

const activityLevel = (count: number, max: number) => {
  if (count === 0) return { label: 'Sem atividade', dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' }
  const pct = max > 0 ? count / max : 0
  if (pct >= 0.6) return { label: 'Alta atividade', dot: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/10' }
  if (pct >= 0.3) return { label: 'Atividade média', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10' }
  return { label: 'Baixa atividade', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-900/10' }
}

const ControleBombas = ({ bombaRows }: ControleBombasProps) => {
  const maxAbast = Math.max(...bombaRows.map((b) => b.abastecimentos), 1)

  return (
    <div className="space-y-4">
      {/* Pump cards grid */}
      {bombaRows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <Gauge className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">Nenhuma bomba encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bombaRows.map((bomba) => {
            const activity = activityLevel(bomba.abastecimentos, maxAbast)
            return (
              <div
                key={bomba.bombaCodigo}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                      <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{bomba.descricao}</p>
                      {bomba.referencia && (
                        <p className="text-[10px] text-gray-400">Ref: {bomba.referencia}</p>
                      )}
                    </div>
                  </div>
                  <div className={cn('flex items-center gap-1.5 rounded-full px-2 py-1', activity.bg)}>
                    <span className={cn('h-2 w-2 rounded-full', activity.dot)} />
                    <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">{activity.label}</span>
                  </div>
                </div>

                {/* Combustíveis tags */}
                {bomba.combustiveis.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {bomba.combustiveis.map((c) => (
                      <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Litros</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(bomba.litrosVendidos)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Abastec.</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(bomba.abastecimentos)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Faturamento</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(bomba.faturamento)}</p>
                  </div>
                </div>

                {/* Activity bar */}
                <div className="mt-3">
                  <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', activity.dot.replace('bg-', 'bg-'))}
                      style={{ width: `${maxAbast > 0 ? (bomba.abastecimentos / maxAbast) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                  <span>{bomba.quantidadeBicos} bico{bomba.quantidadeBicos !== 1 ? 's' : ''}</span>
                  {bomba.ilha > 0 && <span>Ilha {bomba.ilha}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Chart */}
      {bombaRows.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Litros por Bomba</h3>
          <ResponsiveContainer width="100%" height={Math.max(250, bombaRows.length * 40)}>
            <BarChart data={bombaRows} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis type="number" tickFormatter={(v: number) => formatLiters(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="descricao" width={110} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={((v: number, name: string) => [name === 'Faturamento' ? formatCurrencyTooltip(v) : formatLiters(v), name]) as never}
              />
              <Bar dataKey="litrosVendidos" name="Litros" fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default ControleBombas
