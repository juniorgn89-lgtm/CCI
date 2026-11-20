import { useEffect, useState } from 'react'
import { Ban, Loader2, MessageSquareReply, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, cancelarChamado, fmtQuando, type ChamadoRow, type ChamadoStatus, type ResultadoCentral } from '@/api/supabase/chamados'

/**
 * Peças comuns da situação de um chamado (Painel › Chamados e Meus chamados).
 * Mesmo desenho do NotaOK:
 *   SeloStatus    — status vindo da Central (ou "Cancelado" pelo autor)
 *   RespostaCCI   — a resposta da CCI / o motivo do cancelamento
 *   ModalCancelar — cancelar com motivo obrigatório
 */

const STATUS_CLS: Record<ChamadoStatus, string> = {
  novo: 'bg-[#1e3a5f] text-white dark:bg-blue-600',
  analise: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  resolvido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  descartado: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
  cancelado: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

export const SeloStatus = ({ status }: { status: ChamadoStatus }) => (
  <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', STATUS_CLS[status] ?? STATUS_CLS.novo)}>
    {STATUS_LABEL[status] ?? status}
  </span>
)

/** Resposta da CCI (vinda da Central) ou motivo do cancelamento. */
export const RespostaCCI = ({ chamado: c }: { chamado: ChamadoRow }) => {
  if (c.status === 'cancelado') {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] dark:border-rose-500/25 dark:bg-rose-500/10">
        <p className="flex items-center gap-1.5 font-semibold text-rose-800 dark:text-rose-200">
          <Ban className="h-4 w-4" /> Cancelado{c.cancelado_em ? ` em ${fmtQuando(c.cancelado_em)}` : ''}
        </p>
        {c.cancelado_motivo && <p className="mt-1 text-gray-700 dark:text-gray-300">Motivo: {c.cancelado_motivo}</p>}
        {c.central_id && !c.central_cancelado_em && (
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">A CCI ainda vai ser avisada (o Visor tenta de novo sozinho).</p>
        )}
      </div>
    )
  }
  if (!c.resposta) {
    // Encerrado pela CCI sem nota: não dizer "ainda não respondeu".
    if (c.status === 'resolvido' || c.status === 'descartado') {
      return (
        <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
          {c.status === 'resolvido' ? 'Resolvido' : 'Encerrado'} pela CCI{c.resolvido_por_nome ? ` (${c.resolvido_por_nome})` : ''}, sem comentário.
        </p>
      )
    }
    return c.central_id
      ? <p className="text-[12.5px] text-gray-500 dark:text-gray-400">A CCI ainda não respondeu. O status muda aqui quando a CCI analisar.</p>
      : null
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] dark:border-gray-700 dark:bg-white/[0.03]">
      <p className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
        <MessageSquareReply className="h-4 w-4 text-[#2563eb] dark:text-blue-400" /> Resposta da CCI{c.resolvido_por_nome ? ` · ${c.resolvido_por_nome}` : ''}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300">{c.resposta}</p>
    </div>
  )
}

/** Cancelar chamado: motivo obrigatório (mín. 5 letras). */
export const ModalCancelar = ({ chamado: c, onFechar, onCancelado }: {
  chamado: ChamadoRow
  onFechar: () => void
  onCancelado: (novo: ChamadoRow, r: ResultadoCentral) => void
}) => {
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ok = motivo.trim().length >= 5

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar, salvando])

  const cancelar = async () => {
    setSalvando(true); setErro(null)
    try {
      const r = await cancelarChamado(c.id, motivo.trim())
      const agora = new Date().toISOString()
      onCancelado({
        ...c,
        status: 'cancelado',
        cancelado_motivo: motivo.trim(),
        cancelado_em: agora,
        central_cancelado_em: r.ok && c.central_id && !r.local ? agora : null,
      }, r)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) onFechar() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cancelar-titulo" className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#111]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Ban className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p id="cancelar-titulo" className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cancelar chamado</p>
              <p className="line-clamp-2 text-[12px] text-gray-500 dark:text-gray-400">{c.descricao.slice(0, 120)}</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} disabled={salvando} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4">
          <label htmlFor="motivo-cancelar" className="mb-1.5 block text-[12px] font-semibold text-gray-700 dark:text-gray-300">
            Por que você está cancelando? <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="motivo-cancelar"
            autoFocus
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: era um teste / já resolvi sozinho / abri em duplicidade"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100"
          />
          <p className="mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">A CCI vê o motivo junto do chamado.</p>
          {erro && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button type="button" onClick={onFechar} disabled={salvando} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            Voltar
          </button>
          <button type="button" onClick={() => void cancelar()} disabled={!ok || salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-rose-700 disabled:opacity-40">
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Cancelar chamado
          </button>
        </div>
      </div>
    </div>
  )
}
