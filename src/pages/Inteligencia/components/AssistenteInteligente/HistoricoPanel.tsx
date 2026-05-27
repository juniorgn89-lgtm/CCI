import { useState } from 'react'
import { Star, RotateCcw, Trash2, Clock, User, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_HISTORY, type MockHistoryItem } from './mockData'

const formatRel = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const HistoricoPanel = () => {
  const [items, setItems] = useState<MockHistoryItem[]>(MOCK_HISTORY)
  const [query, setQuery] = useState('')
  const [onlyFav, setOnlyFav] = useState(false)

  const filtered = items.filter((i) => {
    if (onlyFav && !i.favorito) return false
    if (query && !i.question.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const toggleFav = (id: string) =>
    setItems((curr) => curr.map((i) => (i.id === id ? { ...i, favorito: !i.favorito } : i)))

  const remove = (id: string) => setItems((curr) => curr.filter((i) => i.id !== id))

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nas perguntas…"
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => setOnlyFav((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            onlyFav
              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
          )}
        >
          <Star className={cn('h-3.5 w-3.5', onlyFav && 'fill-current')} />
          Favoritos
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2 text-left font-medium">Pergunta</th>
              <th className="px-3 py-2 text-left font-medium">Usuário</th>
              <th className="px-3 py-2 text-left font-medium">Data / Hora</th>
              <th className="px-3 py-2 text-right font-medium">Tempo</th>
              <th className="px-3 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleFav(i.id)}
                    className="text-gray-300 transition-colors hover:text-amber-500 dark:text-gray-600 dark:hover:text-amber-400"
                    title={i.favorito ? 'Desfavoritar' : 'Favoritar'}
                  >
                    <Star className={cn('h-4 w-4', i.favorito && 'fill-amber-400 text-amber-400')} />
                  </button>
                </td>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{i.question}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <User className="h-3 w-3" />
                    {i.userName}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRel(i.timestamp)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {i.durationMs} ms
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      className="rounded-md p-1 text-gray-400 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 dark:hover:text-purple-400"
                      title="Repetir pergunta"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(i.id)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                  Nenhuma pergunta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HistoricoPanel
