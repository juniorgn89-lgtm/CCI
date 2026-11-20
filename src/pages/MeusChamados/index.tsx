import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Bug, Loader2, RefreshCw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { fetchMeusChamados, sincronizarComCentral, TIPO_LABEL, STATUS_FINAL, fmtQuando, type ChamadoRow } from '@/api/supabase/chamados'
import { SeloStatus, RespostaCCI, ModalCancelar } from '@/components/chamados/SituacaoChamado'

/**
 * Meus chamados: o que EU abri pelo botão de inseto, com o status e a resposta
 * vindos da Central CCI. Só para quem tem a permissão de abrir chamado.
 * Aqui não se muda status (quem decide é a CCI); dá para cancelar, com motivo.
 * Mesmo modelo do NotaOK.
 */
const MeusChamados = () => {
  const user = useAuthStore((s) => s.user)
  const podeAbrir = useAuthStore((s) => s.canAbrirChamados)
  const profileLoaded = useAuthStore((s) => s.profileLoaded)
  const qc = useQueryClient()
  const chave = ['meus-chamados', user?.id]
  const { data: lista, isLoading, error, refetch } = useQuery({
    queryKey: chave,
    queryFn: () => fetchMeusChamados(user!.id),
    enabled: !!user && podeAbrir,
  })
  const [sincronizando, setSincronizando] = useState(false)
  const [cancelando, setCancelando] = useState<ChamadoRow | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Ao abrir: mostra o que já tem e pergunta à Central o status/resposta.
  const atualizar = async () => {
    setSincronizando(true)
    const r = await sincronizarComCentral()
    if (r?.atualizados) await refetch()
    setSincronizando(false)
  }
  useEffect(() => {
    if (user && podeAbrir) void atualizar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, podeAbrir])

  if (profileLoaded && !podeAbrir) return <Navigate to="/dashboard" replace />

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-16">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Bug className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Meus chamados</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">O que você reportou pelo botão de inseto no topo. A CCI analisa e responde por aqui.</p>
        </div>
        <button
          type="button"
          onClick={() => void atualizar().then(() => refetch())}
          disabled={sincronizando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', sincronizando && 'animate-spin')} /> Atualizar
        </button>
      </div>

      {aviso && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">{aviso}</p>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{(error as Error).message}</p>
      ) : isLoading || !lista ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <Bug className="mx-auto mb-2 h-6 w-6 text-gray-400" />
          Você ainda não abriu nenhum chamado. Para reportar um problema ou pedir uma melhoria, clique no inseto no topo de qualquer tela.
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((c) => (
            <li key={c.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#111] sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <SeloStatus status={c.status} />
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-300">{TIPO_LABEL[c.tipo]}</span>
                <span className="text-[12px] tabular-nums text-gray-500 dark:text-gray-400">{fmtQuando(c.criado_em)}</span>
                {!c.central_id && c.status !== 'cancelado' && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-amber-700 dark:text-amber-300"><Send className="h-3.5 w-3.5" /> aguardando envio à CCI</span>
                )}
                <span className="flex-1" />
                {!STATUS_FINAL.includes(c.status) && (
                  <button
                    type="button"
                    onClick={() => setCancelando(c)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  >
                    <Ban className="h-3.5 w-3.5" /> Cancelar
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-gray-900 dark:text-gray-100">{c.descricao}</p>
              <RespostaCCI chamado={c} />
            </li>
          ))}
        </ul>
      )}

      {cancelando && (
        <ModalCancelar
          chamado={cancelando}
          onFechar={() => setCancelando(null)}
          onCancelado={(novo, r) => {
            setCancelando(null)
            qc.setQueryData<ChamadoRow[]>(chave, (l) => l?.map((x) => (x.id === novo.id ? { ...x, ...novo } : x)))
            setAviso(r.ok || !novo.central_id ? 'Chamado cancelado.' : 'Chamado cancelado. A CCI será avisada assim que possível.')
          }}
        />
      )}
    </div>
  )
}

export default MeusChamados
