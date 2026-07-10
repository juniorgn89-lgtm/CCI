import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, MessageSquare, Edit2, Trash2, Check, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { listCaduConversas, deleteCaduConversa, renameCaduConversa, type CaduConversaRow } from '@/api/supabase/caduConversas'
import { useCaduChat } from './caduChatStore'
import { cn } from '@/lib/utils'

type Grupo = 'hoje' | 'ontem' | 'anteriores'
const GRUPO_LABEL: Record<Grupo, string> = { hoje: 'Hoje', ontem: 'Ontem', anteriores: 'Anteriores' }

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const grupoDe = (iso: string): Grupo => {
  const dia = startOfDay(new Date(iso)).getTime()
  const hoje = startOfDay(new Date()).getTime()
  if (dia === hoje) return 'hoje'
  if (dia === hoje - 86_400_000) return 'ontem'
  return 'anteriores'
}
const fmtData = (iso: string): string => {
  const d = new Date(iso)
  const g = grupoDe(iso)
  if (g === 'hoje') return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (g === 'ontem') return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Sidebar de conversas do Cadu (estilo histórico do ChatGPT): Nova conversa +
 * busca + lista agrupada por Hoje/Ontem/Anteriores, com renomear/apagar. As
 * conversas vivem no Supabase (cadu_conversas); o chat ao lado lê a ativa do
 * caduChatStore.
 */
const ConversasSidebar = ({ className }: { className?: string }) => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const conversaId = useCaduChat((s) => s.conversaId)
  const loadConversa = useCaduChat((s) => s.loadConversa)
  const newConversa = useCaduChat((s) => s.newConversa)
  const qc = useQueryClient()

  const [busca, setBusca] = useState('')
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ['cadu-conversas', redeId, userId],
    queryFn: () => listCaduConversas(redeId as string, userId as string),
    enabled: !!redeId && !!userId,
    staleTime: 30 * 1000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cadu-conversas', redeId, userId] })
  const excluir = async (id: string) => {
    if (!window.confirm('Excluir esta conversa? Esta ação não pode ser desfeita.')) return
    await deleteCaduConversa(id)
    if (id === conversaId) newConversa()
    invalidate()
  }
  const toggleSel = (id: string) =>
    setSelecionadas((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const excluirSelecionadas = async () => {
    const ids = [...selecionadas]
    if (ids.length === 0) return
    if (!window.confirm(`Excluir ${ids.length} conversa${ids.length > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`)) return
    await Promise.all(ids.map((id) => deleteCaduConversa(id)))
    if (conversaId && selecionadas.has(conversaId)) newConversa()
    setSelecionadas(new Set())
    invalidate()
  }
  const confirmarRenomear = async () => {
    if (!renomeandoId) return
    const t = novoTitulo.trim()
    if (t) { await renameCaduConversa(renomeandoId, t); invalidate() }
    setRenomeandoId(null)
  }

  const termo = busca.trim().toLowerCase()
  const filtradas = termo ? conversas.filter((c) => (c.titulo || '').toLowerCase().includes(termo)) : conversas
  const grupos: Record<Grupo, CaduConversaRow[]> = { hoje: [], ontem: [], anteriores: [] }
  for (const c of filtradas) grupos[grupoDe(c.updated_at)].push(c)

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900', className)}>
      <div className="space-y-2 border-b border-gray-100 p-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => newConversa()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2b4a72] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:from-[#24466f] hover:to-[#345888]"
        >
          <Plus className="h-4 w-4 text-[#5eead4]" /> Nova conversa
        </button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#2563eb] focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {selecionadas.size > 0 && (
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50">
          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {selecionadas.size} selecionada{selecionadas.size > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => void excluirSelecionadas()}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700"
          >
            <Trash2 className="h-3 w-3" /> Excluir
          </button>
          <button
            type="button"
            onClick={() => setSelecionadas(new Set())}
            className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Limpar
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : filtradas.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-gray-400">
            {conversas.length === 0 ? 'Nenhuma conversa ainda. Clique em "Nova conversa" pra começar.' : 'Nenhuma conversa encontrada.'}
          </p>
        ) : (
          (['hoje', 'ontem', 'anteriores'] as Grupo[]).map((g) => {
            const lista = grupos[g]
            if (lista.length === 0) return null
            return (
              <div key={g}>
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{GRUPO_LABEL[g]}</p>
                <div className="space-y-0.5">
                  {lista.map((c) => {
                    const ativa = c.id === conversaId
                    if (renomeandoId === c.id) {
                      return (
                        <div key={c.id} className="flex items-center gap-1 rounded-lg p-2">
                          <input
                            value={novoTitulo}
                            onChange={(e) => setNovoTitulo(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') void confirmarRenomear(); if (e.key === 'Escape') setRenomeandoId(null) }}
                            autoFocus
                            className="flex-1 rounded border border-[#2563eb] px-2 py-1 text-xs outline-none dark:bg-gray-800 dark:text-gray-100"
                          />
                          <button onClick={() => void confirmarRenomear()} title="Salvar" className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setRenomeandoId(null)} title="Cancelar" className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={c.id}
                        className={cn('group relative flex items-center gap-1 rounded-lg pl-1.5 transition-colors', ativa ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}
                        style={ativa ? { boxShadow: 'inset 2px 0 0 #2563eb' } : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={selecionadas.has(c.id)}
                          onChange={() => toggleSel(c.id)}
                          aria-label="Selecionar conversa"
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-[#2563eb] focus:ring-1 focus:ring-[#2563eb] dark:border-gray-600 dark:bg-gray-800"
                        />
                        <button onClick={() => loadConversa(c.id, c.mensagens ?? [])} className="flex min-w-0 flex-1 items-start gap-2 py-2 pr-1 text-left">
                          <MessageSquare className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', ativa ? 'text-[#2563eb]' : 'text-gray-400')} />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-xs', ativa ? 'font-semibold text-[#1e3a5f] dark:text-blue-200' : 'font-medium text-gray-700 dark:text-gray-300')}>{c.titulo || 'Conversa'}</span>
                            <span className="mt-0.5 block text-[10px] text-gray-400">{fmtData(c.updated_at)}</span>
                          </span>
                        </button>
                        <span className="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => { setRenomeandoId(c.id); setNovoTitulo(c.titulo || '') }}
                            title="Renomear"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                          ><Edit2 className="h-3 w-3" /></button>
                          <button
                            type="button"
                            onClick={() => void excluir(c.id)}
                            title="Apagar"
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          ><Trash2 className="h-3 w-3" /></button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default ConversasSidebar
