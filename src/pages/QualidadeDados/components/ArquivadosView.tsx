import { useMemo, useState } from 'react'
import { Inbox, RotateCcw, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ArquivadoRow } from '@/api/supabase/qualidadeArquivados'

interface ArquivadosViewProps {
  arquivados: ArquivadoRow[]
  isLoading: boolean
  onReabrir: (id: string) => Promise<void>
}

const tipoLabel: Record<string, string> = {
  'data-futura': 'Data futura',
  'sem-frentista': 'Sem frentista',
  'preco-anormal': 'Preço anormal',
  'litros-suspeito': 'Litros suspeito',
  'item-sem-produto': 'Venda · produto inexistente',
  'caixa-aberto-muito': 'Caixa aberto > 3 dias',
  'caixa-diferenca-anormal': 'Diferença anormal',
  'estoque-negativo': 'Estoque negativo',
  'titulo-sem-vencimento': 'Título sem vencimento',
}

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Lista completa de arquivamentos (ativos + restaurados). Mostra histórico
 * de quem arquivou + quando, com botão pra reabrir os ainda ativos.
 */
const ArquivadosView = ({ arquivados, isLoading, onReabrir }: ArquivadosViewProps) => {
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ativos' | 'restaurados'>('ativos')
  const [reabrindo, setReabrindo] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return arquivados.filter((a) => {
      if (filtroTipo === 'ativos' && a.restaurado_em !== null) return false
      if (filtroTipo === 'restaurados' && a.restaurado_em === null) return false
      if (q && !a.rotulo.toLowerCase().includes(q) && !a.tipo_issue.toLowerCase().includes(q)) return false
      return true
    })
  }, [arquivados, filtroTipo, busca])

  const handleReabrir = async (id: string) => {
    setReabrindo(id)
    try {
      await onReabrir(id)
    } finally {
      setReabrindo(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por rótulo ou tipo..."
            className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {([
            { v: 'ativos', l: 'Ativos' },
            { v: 'restaurados', l: 'Restaurados' },
            { v: 'todos', l: 'Todos' },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setFiltroTipo(opt.v)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                filtroTipo === opt.v
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Inbox className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nada arquivado por aqui</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Selecione lançamentos na aba "Ativos" e use o botão Arquivar pra esconder da visão principal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Detector</th>
                  <th className="px-3 py-2 text-left font-medium">Lançamento</th>
                  <th className="px-3 py-2 text-left font-medium">Arquivado por</th>
                  <th className="px-3 py-2 text-left font-medium">Em</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((a) => {
                  const isAtivo = a.restaurado_em === null
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {tipoLabel[a.tipo_issue] ?? a.tipo_issue}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{a.rotulo}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{a.arquivado_por_nome}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{fmtDateTime(a.arquivado_em)}</td>
                      <td className="px-3 py-2">
                        {isAtivo ? (
                          <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Arquivado
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            title={`Restaurado por ${a.restaurado_por_nome ?? '—'} em ${a.restaurado_em ? fmtDateTime(a.restaurado_em) : '—'}`}
                          >
                            Restaurado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isAtivo && (
                          <button
                            type="button"
                            onClick={() => handleReabrir(a.id)}
                            disabled={reabrindo === a.id}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
                          >
                            <RotateCcw className={cn('h-3 w-3', reabrindo === a.id && 'animate-spin')} />
                            {reabrindo === a.id ? 'Reabrindo...' : 'Reabrir'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ArquivadosView
