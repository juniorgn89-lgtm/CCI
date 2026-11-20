import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bug, Loader2, X, ImageOff, ExternalLink, Cloud, CloudOff, Ban, Trash2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  fetchChamados, urlPrint, enviarParaCentral, excluirChamado, sincronizarComCentral,
  TIPO_LABEL, STATUS_FINAL, ehAberto, fmtQuando, type ChamadoRow, type ChamadoStatus, type ChamadoTipo,
} from '@/api/supabase/chamados'
import { SeloStatus, RespostaCCI, ModalCancelar } from '@/components/chamados/SituacaoChamado'

/**
 * Painel → Chamados (só diretores): o que foi reportado pelo botão do topo,
 * com print, contexto (tela, filtros, rede, versão, erros) e status.
 * O status e a resposta são da Central CCI (aqui só aparecem; sincroniza ao
 * abrir). Daqui dá para reenviar/excluir o que não chegou e cancelar.
 */

const TIPO_CLS: Record<ChamadoTipo, string> = {
  bug: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  melhoria: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  numero: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  duvida: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
}
type Filtro = 'abertos' | ChamadoStatus | 'todos'
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'abertos', label: 'Abertos' },
  { id: 'novo', label: 'Novos' },
  { id: 'analise', label: 'Em análise' },
  { id: 'resolvido', label: 'Resolvidos' },
  { id: 'descartado', label: 'Descartados' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
]

const Chamados = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const { data, isLoading, error } = useQuery({ queryKey: ['chamados'], queryFn: fetchChamados, enabled: isMaster })
  const [filtro, setFiltro] = useState<Filtro>('abertos')
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  const todos = useMemo(() => data ?? [], [data])
  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { abertos: 0, novo: 0, analise: 0, resolvido: 0, descartado: 0, cancelado: 0, todos: todos.length }
    for (const ch of todos) { c[ch.status]++; if (ehAberto(ch.status)) c.abertos++ }
    return c
  }, [todos])
  // Central CCI: undefined = coluna ainda não existe (SQL não rodado) → não mostra nada.
  const integrado = todos.some((c) => c.central_id !== undefined)
  const pendentes = todos.filter((c) => c.central_id === null)
  const qc = useQueryClient()
  // O detalhe acompanha a lista (depois de sincronizar / salvar).
  const aberto = abertoId ? todos.find((c) => c.id === abertoId) ?? null : null

  // Ao abrir: pergunta à Central o status/resposta (e reenvia cancelamentos pendentes).
  const sincronizar = async () => {
    setSincronizando(true)
    const r = await sincronizarComCentral()
    if (r?.atualizados) await qc.invalidateQueries({ queryKey: ['chamados'] })
    setSincronizando(false)
  }
  useEffect(() => {
    if (isMaster) void sincronizar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster])

  const excluir = async (c: ChamadoRow) => {
    if (!confirm(`Excluir o chamado "${c.descricao.slice(0, 80)}"?\n\nEle ainda não foi para a Central CCI e será apagado de vez, com o print.`)) return false
    try {
      await excluirChamado(c)
      await qc.invalidateQueries({ queryKey: ['chamados'] })
      return true
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const [enviando, setEnviando] = useState<{ feitos: number; total: number; falhas: number } | null>(null)
  const enviarPendentes = async () => {
    const fila = pendentes.map((c) => c.id)
    let falhas = 0
    setEnviando({ feitos: 0, total: fila.length, falhas: 0 })
    for (let i = 0; i < fila.length; i++) {
      try { await enviarParaCentral(fila[i]) } catch { falhas++ }
      setEnviando({ feitos: i + 1, total: fila.length, falhas })
    }
    await qc.invalidateQueries({ queryKey: ['chamados'] })
    setEnviando(null)
    if (falhas) alert(`${falhas} chamado(s) não chegaram na Central. Abra um deles para ver o motivo.`)
  }
  const lista = todos.filter((c) => filtro === 'todos' || (filtro === 'abertos' ? ehAberto(c.status) : c.status === filtro))

  if (!isMaster) return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-4 pb-16">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Bug className="h-4 w-4" /></span>
        <div>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chamados</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Bugs, melhorias, números estranhos e dúvidas enviados pelo botão de inseto no topo. O status vem da Central CCI.</p>
        </div>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={sincronizando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', sincronizando && 'animate-spin')} /> Atualizar
        </button>
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

      {integrado && (pendentes.length > 0 || enviando) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {enviando
              ? `Enviando para a Central CCI… ${enviando.feitos} de ${enviando.total}`
              : `${pendentes.length} chamado(s) ainda não chegaram na Central CCI.`}
          </span>
          <button type="button" disabled={!!enviando} onClick={() => void enviarPendentes()} className="rounded-md bg-amber-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
            Enviar para a Central
          </button>
        </div>
      )}

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
                {integrado && <th className="px-4 py-2.5 font-semibold">Central</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {lista.map((c) => (
                <tr key={c.id} onClick={() => setAbertoId(c.id)} className="cursor-pointer text-gray-800 hover:bg-gray-50/60 dark:text-gray-200 dark:hover:bg-gray-800/30">
                  <td className="whitespace-nowrap px-4 py-3"><SeloStatus status={c.status} /></td>
                  <td className="whitespace-nowrap px-3 py-3"><span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', TIPO_CLS[c.tipo])}>{TIPO_LABEL[c.tipo]}</span></td>
                  <td className="max-w-[420px] px-3 py-3"><span className="line-clamp-2">{c.descricao}</span></td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="block font-mono">{c.contexto?.tela ?? '—'}</span>
                    {c.contexto?.rede?.nome && <span className="block">{c.contexto.rede.nome}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">{c.autor_nome ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500 dark:text-gray-400">{fmtQuando(c.criado_em)}</td>
                  {integrado && (
                    <td className="whitespace-nowrap px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                      {c.central_id
                        ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Cloud className="h-3.5 w-3.5" /> Enviado</span>
                        : (
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><CloudOff className="h-3.5 w-3.5" /> Pendente</span>
                            <button
                              type="button"
                              onClick={() => void excluir(c)}
                              disabled={!!enviando}
                              aria-label={`Excluir o chamado "${c.descricao.slice(0, 40)}"`}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </button>
                          </span>
                        )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberto && (
        <Detalhe
          chamado={aberto}
          onClose={() => setAbertoId(null)}
          onExcluir={async (c) => { if (await excluir(c)) setAbertoId(null) }}
        />
      )}
    </div>
  )
}

const Linha = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[110px_1fr] gap-2 text-[12px]">
    <span className="text-gray-500 dark:text-gray-400">{rotulo}</span>
    <span className="min-w-0 break-words text-gray-800 dark:text-gray-200">{children}</span>
  </div>
)

const Detalhe = ({ chamado: c, onClose, onExcluir }: { chamado: ChamadoRow; onClose: () => void; onExcluir: (c: ChamadoRow) => void }) => {
  const qc = useQueryClient()
  const { data: url, isLoading: carregandoPrint, error: erroPrint } = useQuery({
    queryKey: ['chamado-print', c.print_path],
    queryFn: () => urlPrint(c.print_path!),
    enabled: !!c.print_path,
    staleTime: 50 * 60 * 1000,
  })
  const [cancelando, setCancelando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ctx = c.contexto ?? ({} as ChamadoRow['contexto'])
  const [enviandoCentral, setEnviandoCentral] = useState(false)
  const enviarCentral = async () => {
    setErro(null); setEnviandoCentral(true)
    try {
      await enviarParaCentral(c.id)
      await qc.invalidateQueries({ queryKey: ['chamados'] })
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) } finally { setEnviandoCentral(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#111]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', TIPO_CLS[c.tipo])}>{TIPO_LABEL[c.tipo]}</span>
              <SeloStatus status={c.status} />
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
            <p className="inline-flex items-center gap-1.5 text-[12px] text-gray-500"><ImageOff className="h-3.5 w-3.5" /> {c.central_id ? 'O print fica só na Central CCI (apagado 90 dias depois).' : 'Sem print'}</p>
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
            {c.central_id !== undefined && (
              <Linha rotulo="Central CCI">
                {c.central_id ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Enviado{c.central_enviado_em ? ` em ${fmtQuando(c.central_enviado_em)}` : ''}</span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-amber-600 dark:text-amber-400">Ainda não chegou{c.central_erro ? ` — ${c.central_erro}` : ''}</span>
                    <button type="button" disabled={enviandoCentral} onClick={() => void enviarCentral()} className="rounded-md border border-amber-500 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-950/40">
                      {enviandoCentral ? 'Enviando…' : 'Enviar agora'}
                    </button>
                    <button type="button" disabled={enviandoCentral} onClick={() => onExcluir(c)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-gray-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10">
                      <Trash2 className="h-3 w-3" /> Excluir
                    </button>
                  </span>
                )}
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

          {/* Status e resposta são da Central CCI (aqui só aparecem). */}
          <RespostaCCI chamado={c} />
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <p className="mr-auto text-[12px] text-gray-500 dark:text-gray-400">O status é dado pela Central CCI.</p>
          {!STATUS_FINAL.includes(c.status) && (
            <button type="button" onClick={() => setCancelando(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">
              <Ban className="h-3.5 w-3.5" /> Cancelar chamado
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            Fechar
          </button>
        </div>
      </div>
      {cancelando && (
        <ModalCancelar
          chamado={c}
          onFechar={() => setCancelando(false)}
          onCancelado={() => { setCancelando(false); void qc.invalidateQueries({ queryKey: ['chamados'] }) }}
        />
      )}
    </div>
  )
}

export default Chamados
