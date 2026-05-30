import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Trash2, Search, MessageSquare, Loader2, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { listCaduConversas, deleteCaduConversa, type CaduConversaRow } from '@/api/supabase/caduConversas'
import { useCaduChat } from './caduChatStore'

const formatRel = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

interface HistoricoPanelProps {
  /** Abre a conversa no Chat (troca pra aba Chat). */
  onOpen: () => void
}

const HistoricoPanel = ({ onOpen }: HistoricoPanelProps) => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const qc = useQueryClient()
  const [query, setQuery] = useState('')

  const activeId = useCaduChat((s) => s.conversaId)
  const loadConversa = useCaduChat((s) => s.loadConversa)

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ['cadu-conversas', redeId, userId],
    queryFn: () => (redeId && userId ? listCaduConversas(redeId, userId) : Promise.resolve([])),
    enabled: !!redeId && !!userId,
  })

  const filtered = conversas.filter((c) =>
    query ? c.titulo.toLowerCase().includes(query.toLowerCase()) : true,
  )

  const abrir = (c: CaduConversaRow) => {
    loadConversa(c.id, c.mensagens ?? [])
    onOpen()
  }

  const excluir = async (id: string) => {
    await deleteCaduConversa(id)
    if (useCaduChat.getState().conversaId === id) useCaduChat.getState().newConversa()
    void qc.invalidateQueries({ queryKey: ['cadu-conversas', redeId, userId] })
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar conversas…"
          className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-10 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversas…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <MessageSquare className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {query ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa salva ainda.'}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            As conversas com o Cadu são salvas automaticamente e aparecem aqui pra você retomar.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900/60">
          {filtered.map((c) => {
            const isActive = c.id === activeId
            const nMsgs = (c.mensagens ?? []).length
            return (
              <li
                key={c.id}
                className={cn(
                  'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40',
                  isActive && 'bg-blue-50/60 dark:bg-blue-900/20',
                )}
              >
                <button
                  type="button"
                  onClick={() => abrir(c)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  title="Abrir conversa"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {c.titulo}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatRel(c.updated_at)}
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      {nMsgs} {nMsgs === 1 ? 'mensagem' : 'mensagens'}
                      {isActive && <span className="text-blue-600 dark:text-blue-400">· aberta</span>}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={() => excluir(c.id)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Excluir conversa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default HistoricoPanel
