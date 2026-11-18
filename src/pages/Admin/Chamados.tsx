import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bug, Loader2, X, ImageOff, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  fetchChamados, urlPrint, atualizarChamado,
  TIPO_LABEL, STATUS_LABEL, type ChamadoRow, type ChamadoStatus, type ChamadoTipo,
} from '@/api/supabase/chamados'

/**
 * Painel → Chamados (só diretores): o que foi reportado pelo botão do topo,
 * com print, contexto (tela, filtros, rede, versão, erros) e status.
 */

const TIPO_CLS: Record<ChamadoTipo, string> = {
  bug: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  melhoria: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  numero: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  duvida: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
}
const STATUS_CLS: Record<ChamadoStatus, string> = {
  novo: 'bg-[#1e3a5f] text-white dark:bg-blue-600',
  analise: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  resolvido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  descartado: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
}
type Filtro = 'abertos' | ChamadoStatus | 'todos'
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'abertos', label: 'Abertos' },
  { id: 'novo', label: 'Novos' },
  { id: 'analise', label: 'Em análise' },
  { id: 'resolvido', label: 'Resolvidos' },
  { id: 'descartado', label: 'Descartados' },
  { id: 'todos', label: 'Todos' },
]

const fmtQuando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const Chamados = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const { data, isLoading, error } = useQuery({ queryKey: ['chamados'], queryFn: fetchChamados, enabled: isMaster })
  const [filtro, setFiltro] = useState<Filtro>('abertos')
  const [aberto, setAberto] = useState<ChamadoRow | null>(null)

  const todos = useMemo(() => data ?? [], [data])
  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { abertos: 0, novo: 0, analise: 0, resolvido: 0, descartado: 0, todos: todos.length }
    for (const ch of todos) { c[ch.status]++; if (ch.status === 'novo' || ch.status === 'analise') c.abertos++ }
    return c
  }, [todos])
  const lista = todos.filter((c) => filtro === 'todos' || (filtro === 'abertos' ? c.status === 'novo' || c.status === 'analise' : c.status === filtro))

  if (!isMaster) return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-4 pb-16">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Bug className="h-4 w-4" /></span>
        <div>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chamados</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Bugs, melhorias, números estranhos e dúvidas enviados pelo botão de inseto no topo</p>
        </div>
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={cn('rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors', filtro === f.id ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200')}
          >
            {f.label} <span className="tabular-nums text-gray-400">{contagem[f.id]}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{(error as Error).message}</p>
      ) : isLoading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {todos.length === 0 ? 'Nenhum chamado ainda. Use o botão de inseto no topo de qualquer tela.' : 'Nenhum chamado neste filtro.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Tipo</th>
                <th className="px-3 py-2.5 font-semibold">O que aconteceu</th>
                <th className="px-3 py-2.5 font-semibold">Tela</th>
                <th className="px-3 py-2.5 font-semibold">Quem</th>
                <th className="px-4 py-2.5 font-semibold">Quando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {lista.map((c) => (
                <tr key={c.id} onClick={() => setAberto(c)} className="cursor-pointer text-gray-800 hover:bg-gray-50/60 dark:text-gray-200 dark:hover:bg-gray-800/30">
                  <td className="whitespace-nowrap px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', STATUS_CLS[c.status])}>{STATUS_LABEL[c.status]}</span></td>
                  <td className="whitespace-nowrap px-3 py-3"><span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', TIPO_CLS[c.tipo])}>{TIPO_LABEL[c.tipo]}</span></td>
                  <td className="max-w-[420px] px-3 py-3"><span className="line-clamp-2">{c.descricao}</span></td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="block font-mono">{c.contexto?.tela ?? '—'}</span>
                    {c.contexto?.rede?.nome && <span className="block">{c.contexto.rede.nome}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">{c.autor_nome ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500 dark:text-gray-400">{fmtQuando(c.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberto && <Detalhe chamado={aberto} onClose={() => setAberto(null)} onSalvo={(c) => setAberto(c)} />}
    </div>
  )
}

const Linha = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[110px_1fr] gap-2 text-[12px]">
    <span className="text-gray-500 dark:text-gray-400">{rotulo}</span>
    <span className="min-w-0 break-words text-gray-800 dark:text-gray-200">{children}</span>
  </div>
)

const Detalhe = ({ chamado: c, onClose, onSalvo }: { chamado: ChamadoRow; onClose: () => void; onSalvo: (c: ChamadoRow) => void }) => {
  const qc = useQueryClient()
  const { data: url, isLoading: carregandoPrint, error: erroPrint } = useQuery({
    queryKey: ['chamado-print', c.print_path],
    queryFn: () => urlPrint(c.print_path!),
    enabled: !!c.print_path,
    staleTime: 50 * 60 * 1000,
  })
  const [resposta, setResposta] = useState(c.resposta ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ctx = c.contexto ?? ({} as ChamadoRow['contexto'])

  const mudar = async (status: ChamadoStatus) => {
    setErro(null); setSalvando(true)
    try {
      const r = resposta.trim() || null
      await atualizarChamado(c.id, { status, resposta: r })
      await qc.invalidateQueries({ queryKey: ['chamados'] })
      onSalvo({ ...c, status, resposta: r })
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#111]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', TIPO_CLS[c.tipo])}>{TIPO_LABEL[c.tipo]}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', STATUS_CLS[c.status])}>{STATUS_LABEL[c.status]}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{c.descricao}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {c.print_path ? (
            carregandoPrint ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            : erroPrint || !url ? <p className="text-[12px] text-red-600 dark:text-red-400">Não foi possível abrir o print.</p>
            : (
              <a href={url} target="_blank" rel="noreferrer" className="group relative block w-fit max-w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700" title="Abrir o print em tamanho real">
                <img src={url} alt="Print do chamado" className="block max-h-[50vh] max-w-full" />
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"><ExternalLink className="h-3 w-3" /> Tamanho real</span>
              </a>
            )
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[12px] text-gray-500"><ImageOff className="h-3.5 w-3.5" /> Sem print</p>
          )}

          <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
            <Linha rotulo="Quem / quando">{c.autor_nome ?? '—'} · {fmtQuando(c.criado_em)}</Linha>
            <Linha rotulo="Tela"><span className="font-mono">{ctx.url ?? '—'}</span></Linha>
            <Linha rotulo="Rede">{ctx.rede?.nome ?? 'nenhuma conectada'}</Linha>
            {ctx.filtros && (
              <Linha rotulo="Filtros">
                {ctx.filtros.empresaCodigos?.length ? `postos ${ctx.filtros.empresaCodigos.join(', ')}` : 'todos os postos'} · {ctx.filtros.dataInicial} a {ctx.filtros.dataFinal}
              </Linha>
            )}
            <Linha rotulo="Versão">{ctx.versao ?? '—'} · tema {ctx.tema ?? '—'} · {ctx.viewport ?? '—'}</Linha>
            <Linha rotulo="Navegador"><span className="text-[11px] text-gray-500 dark:text-gray-400">{ctx.navegador ?? '—'}</span></Linha>
            <Linha rotulo="Erros recentes">
              {ctx.erros?.length ? (
                <ul className="space-y-1 font-mono text-[11px] text-red-700 dark:text-red-300">
                  {ctx.erros.map((e, i) => <li key={i}>{new Date(e.quando).toLocaleTimeString('pt-BR')} · {e.mensagem}</li>)}
                </ul>
              ) : <span className="text-gray-500">nenhum registrado</span>}
            </Linha>
          </div>

          <div>
            <label htmlFor="chamado-resp" className="mb-1.5 block text-[12px] font-semibold text-gray-700 dark:text-gray-300">Nota de quem resolveu (opcional)</label>
            <textarea
              id="chamado-resp"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={2}
              placeholder="Ex.: corrigido na versão 1.2.12"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100"
            />
          </div>
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          {(['novo', 'analise', 'resolvido', 'descartado'] as ChamadoStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={salvando || (s === c.status && resposta.trim() === (c.resposta ?? ''))}
              onClick={() => void mudar(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-40',
                s === c.status ? 'border border-[#2563eb] text-[#2563eb] dark:border-blue-500 dark:text-blue-300' : s === 'resolvido' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800',
              )}
            >
              {s === c.status ? `${STATUS_LABEL[s]} (salvar nota)` : `Marcar ${STATUS_LABEL[s].toLowerCase()}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Chamados
