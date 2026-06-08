import { useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters } from '@/lib/formatters'
import { useMetasStore } from '@/store/metas'
import type { FrentistaProdRow } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
}

type StatusFilter = 'todos' | 'atingida' | 'parcial' | 'abaixo' | 'novo'

const STATUS_OPTIONS: { v: StatusFilter; l: string }[] = [
  { v: 'todos', l: 'Todos' },
  { v: 'atingida', l: 'Atingida' },
  { v: 'parcial', l: 'Parcial' },
  { v: 'abaixo', l: 'Abaixo' },
  { v: 'novo', l: 'Novo' },
]

const getStatus = (metaAtual: number, pct: number): StatusFilter => {
  if (metaAtual === 0 || pct > 200) return 'novo'
  if (pct >= 100) return 'atingida'
  if (pct >= 70) return 'parcial'
  return 'abaixo'
}

const Metas = ({ frentistas }: Props) => {
  const { manualMode, metas, setManualMode, setMeta, resetMetas } = useMetasStore()

  // Buffer local: edita aqui, salva via "Salvar metas"
  const [buffer, setBuffer] = useState<Record<number, string>>({})

  // Filtro por status da meta
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')

  // Sincroniza o buffer com o store quando muda modo/lista/metas.
  // Padrão "store info from previous renders" da doc do React.
  const syncKey = `${manualMode}-${frentistas.length}-${Object.values(metas).join(',')}`
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey)
  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey)
    const next: Record<number, string> = {}
    for (const f of frentistas) {
      const v = metas[f.funcionarioCodigo]
      next[f.funcionarioCodigo] = v && v > 0 ? String(v) : ''
    }
    setBuffer(next)
  }

  const dirty = frentistas.some((f) => {
    const buf = buffer[f.funcionarioCodigo] ?? ''
    const stored = metas[f.funcionarioCodigo] ?? 0
    return Number(buf || 0) !== stored
  })

  const handleSave = () => {
    for (const f of frentistas) {
      const v = Number(buffer[f.funcionarioCodigo] ?? 0)
      setMeta(f.funcionarioCodigo, isFinite(v) && v >= 0 ? v : 0)
    }
  }

  return (
    <div className="space-y-5">
      {/* Toggle de modo */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Origem das metas</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Escolha entre usar o mês anterior como referência ou definir metas manualmente.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setManualMode(false)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              !manualMode
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
            )}
          >
            Usar mês anterior como referência
          </button>
          <button
            onClick={() => setManualMode(true)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              manualMode
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
            )}
          >
            Definir meta manual
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {manualMode ? 'Metas manuais' : 'Metas baseadas no mês anterior'}
            </h3>
            {!manualMode && (
              <p className="mt-0.5 italic text-gray-400" style={{ fontSize: '12px' }}>
                Meta: superar o volume do mês anterior por frentista
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setStatusFilter(opt.v)}
                  className={cn(
                    'rounded-lg px-3 py-1 font-medium transition-colors',
                    statusFilter === opt.v
                      ? 'bg-[#1e3a5f] text-white shadow-sm'
                      : 'bg-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
                  )}
                  style={{ fontSize: '13px' }}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          {manualMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetMetas()
                  setBuffer({})
                }}
                className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Limpar
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  dirty
                    ? 'bg-[#1e3a5f] text-white hover:bg-[#172d4a]'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                )}
              >
                <Save className="h-3.5 w-3.5" />
                Salvar metas
              </button>
            </div>
          )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  {manualMode ? 'Meta (litros)' : 'Meta (mês anterior)'}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Realizado</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">% Atingido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(() => {
                const filtered = frentistas.filter((f) => {
                  if (statusFilter === 'todos') return true
                  const metaAuto = f.prevLitros
                  const metaAtual = manualMode ? Number(buffer[f.funcionarioCodigo] ?? 0) : metaAuto
                  const pct = metaAtual > 0 ? (f.litros / metaAtual) * 100 : 0
                  return getStatus(metaAtual, pct) === statusFilter
                })
                if (frentistas.length === 0) {
                  return (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                        Sem frentistas no período.
                      </td>
                    </tr>
                  )
                }
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                        Nenhum frentista com status "{STATUS_OPTIONS.find((o) => o.v === statusFilter)?.l}".
                      </td>
                    </tr>
                  )
                }
                return filtered.map((f, idx) => {
                  const metaAuto = f.prevLitros
                  const metaAtual = manualMode ? Number(buffer[f.funcionarioCodigo] ?? 0) : metaAuto
                  const pct = metaAtual > 0 ? (f.litros / metaAtual) * 100 : 0
                  return (
                    <tr key={f.funcionarioCodigo} className={cn(idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                      <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{f.nome}</td>
                      <td className="px-4 py-2.5 text-right">
                        {manualMode ? (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={buffer[f.funcionarioCodigo] ?? ''}
                            onChange={(e) =>
                              setBuffer((prev) => ({
                                ...prev,
                                [f.funcionarioCodigo]: e.target.value,
                              }))
                            }
                            placeholder="Ex: 45.000"
                            className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1 text-right text-sm tabular-nums text-gray-900 placeholder:text-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-600"
                          />
                        ) : (
                          <span className="text-sm tabular-nums text-gray-900 dark:text-gray-100">
                            {metaAuto > 0 ? formatLiters(metaAuto) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                        {formatLiters(f.litros)}
                      </td>
                      <td className={cn(
                        'px-4 py-2.5 text-right text-sm font-medium tabular-nums',
                        metaAtual === 0 || pct > 200
                          ? 'text-gray-400'
                          : pct >= 100 ? 'text-green-600 dark:text-green-400'
                          : pct >= 70 ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {metaAtual === 0 ? '—' : pct > 200 ? 'Novo' : `${pct.toFixed(0)}%`}
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Metas
