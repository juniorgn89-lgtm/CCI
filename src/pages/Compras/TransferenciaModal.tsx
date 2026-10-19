import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Send, Pencil, Trash2, Check, X, RotateCcw, Truck, PackageCheck, MessageCircle, Copy, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import type { ReportPayload } from '@/lib/report/reportTypes'
import { Modal, ModalRodape, Erro, ConfirmaAcao } from '@/pages/Gestao/comumUi'
import {
  STATUS_TRANSF_LABEL, EVENTO_TRANSF_VERBO, fetchTransfItens, fetchTransfEventos, solicitarTransferencia, despacharTransferencia, receberTransferencia, cancelarTransferencia, reabrirTransferencia, excluirTransferencia, comentarTransferencia,
  type TransferenciaRow, type TransfItemRow,
} from '@/api/supabase/compras'
import { useComprasBase, inputCls, btnPrimary, btnGhost, fmtDataHora, nomeProprio, qtdFmt } from './comum'
import { GUIAS } from '@/lib/guiasModais'
import { SeloTransf } from './Transferencias'

/** Detalhe da transferência: itens, despacho pela origem, conferência pelo destino, histórico, WhatsApp e PDF. */
const TransferenciaModal = ({ transferencia: t, onClose, onMudou, onEditar, modoInicial }: { transferencia: TransferenciaRow; onClose: () => void; onMudou: () => void; onEditar: () => void; modoInicial?: 'conferir' }) => {
  const base = useComprasBase()
  const itensQ = useQuery({ queryKey: ['compras-transf-itens', t.id], queryFn: () => fetchTransfItens(t.id) })
  const eventosQ = useQuery({ queryKey: ['compras-transf-eventos', t.id], queryFn: () => fetchTransfEventos(t.id) })
  const itens = itensQ.data ?? []
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  // "Receber" direto da lista já abre com os campos de conferência (quantidade = enviada até alguém mexer).
  const [conferindo, setConferindo] = useState(modoInicial === 'conferir' && t.status === 'em_transito')
  const [recebidas, setRecebidas] = useState<Record<string, string>>({})
  const [obsAcao, setObsAcao] = useState('')
  const [comentario, setComentario] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [confirma, setConfirma] = useState<'excluir' | 'cancelar' | null>(null)
  const rodar = async (k: string, fn: () => Promise<unknown>) => { setErro(null); setOcupado(k); try { await fn(); onMudou() } catch (e) { setErro((e as Error).message) } finally { setOcupado(null) } }
  const iniciarConferencia = () => { setRecebidas(Object.fromEntries(itens.map((i) => [i.id, String(i.qtd)]))); setConferindo(true) }
  const valorRecebido = (i: TransfItemRow) => (recebidas[i.id] != null ? (Number(recebidas[i.id].replace(',', '.')) || 0) : i.qtd)
  const confirmarRecebimento = () => rodar('receber', async () => { await receberTransferencia(t, itens, Object.fromEntries(itens.map((i) => [i.id, valorRecebido(i)])), base.autor, obsAcao.trim() || null); setConferindo(false) })
  const origem = base.nomePosto(t.origem_codigo), destino = base.nomePosto(t.destino_codigo)
  const texto = () => [`*Transferência nº ${t.numero}* · ${origem} → ${destino}`, '', ...itens.map((i) => `• ${qtdFmt(i.qtd_recebida ?? i.qtd)}${i.unidade ? ` ${i.unidade.toLowerCase()}` : ''} — ${nomeProprio(i.produto_nome)}`), '', t.observacoes ? `Obs.: ${t.observacoes}` : '', `Solicitante: ${t.solicitante_nome ?? ''}`].join('\n')
  const copiar = () => { navigator.clipboard?.writeText(texto()).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }, () => {}) }
  const buildPdf = (): ReportPayload => ({
    title: `Transferência nº ${t.numero}`,
    subtitle: `${origem} → ${destino} · ${STATUS_TRANSF_LABEL[t.status]}`,
    kpis: [{ label: 'Itens', value: String(itens.length) }, { label: 'Valor de referência', value: formatCurrency(t.total_ref) }, { label: 'Solicitante', value: t.solicitante_nome ?? '—' }, { label: 'Despachada por', value: t.enviado_por_nome ?? '—' }],
    sections: [
      { title: 'Itens', rows: itens.map((i) => ({ label: `${nomeProprio(i.produto_nome)} · ${qtdFmt(i.qtd)}${i.unidade ? ` ${i.unidade.toLowerCase()}` : ''}${i.qtd_recebida != null && i.qtd_recebida !== i.qtd ? ` (recebido ${qtdFmt(i.qtd_recebida)})` : ''}`, value: formatCurrency(i.qtd * i.custo_ref), sub: i.justificativa ?? undefined })) },
      ...(t.observacoes ? [{ title: 'Observações', rows: [{ label: t.observacoes, value: '' }] }] : []),
      { title: 'Histórico', rows: (eventosQ.data ?? []).map((e) => ({ label: `${e.autor_nome ?? 'Alguém'} ${EVENTO_TRANSF_VERBO[e.tipo]}`, value: fmtDataHora(e.criado_em), sub: e.detalhe ?? undefined })) },
    ],
    footnote: 'Visor360 · transferência interna entre postos; o lançamento de estoque é feito no ERP.',
  })
  const Info = ({ k, v }: { k: string; v: React.ReactNode }) => <div><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{k}</p><p className="text-[12.5px] text-gray-800 dark:text-gray-200">{v}</p></div>

  return (
    <Modal guia={GUIAS.transferencia} fundo="" open onClose={onClose} titulo={<span className="inline-flex flex-wrap items-center gap-3">Transferência nº {t.numero} <SeloTransf status={t.status} /></span>} descricao={`Criada em ${fmtDataHora(t.criado_em)}${t.enviada_em ? ` · despachada em ${fmtDataHora(t.enviada_em)} por ${t.enviado_por_nome ?? ''}` : ''}${t.recebida_em ? ` · recebida em ${fmtDataHora(t.recebida_em)} por ${t.recebido_por_nome ?? ''}` : ''}`} largura="max-w-4xl">
      <div className="space-y-4">
        <Erro msg={erro} />
        <div className="grid gap-3 rounded-xl border border-gray-200 p-4 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-center dark:border-gray-700">
          <Info k="Origem (manda)" v={origem} />
          <ArrowRight className="hidden h-5 w-5 text-gray-400 sm:block" />
          <Info k="Destino (recebe)" v={destino} />
          <Info k="Solicitante" v={t.solicitante_nome ?? '—'} />
        </div>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700">
          <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Itens ({itens.length})</p>
            <span className="ml-auto text-[12px] tabular-nums text-gray-600 dark:text-gray-300">Valor de referência <b className="font-semibold text-gray-900 dark:text-white">{formatCurrency(t.total_ref)}</b></span>
          </header>
          {itensQ.isLoading ? <p className="inline-flex items-center gap-2 px-4 py-3 text-[12px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p> : (
            <table className="w-full text-[12.5px]">
              <thead className="text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="px-4 py-1.5 text-left font-semibold">Produto</th><th className="px-2 py-1.5 text-right font-semibold">Enviado</th><th className="px-2 py-1.5 text-right font-semibold">Recebido</th><th className="px-4 py-1.5 text-right font-semibold">Ref.</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {itens.map((i: TransfItemRow) => {
                  const rec = conferindo ? valorRecebido(i) : i.qtd_recebida
                  const dif = rec != null && Math.abs(rec - i.qtd) > 1e-9
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-1.5"><p className="font-medium text-gray-900 dark:text-gray-100">{nomeProprio(i.produto_nome)}</p>{i.justificativa && <p className="text-[10.5px] text-gray-400">{i.justificativa}</p>}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{qtdFmt(i.qtd)}{i.unidade ? <span className="text-[10px] text-gray-400"> {i.unidade.toLowerCase()}</span> : null}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{conferindo ? <input inputMode="decimal" value={recebidas[i.id] ?? String(i.qtd)} onChange={(e) => setRecebidas({ ...recebidas, [i.id]: e.target.value })} className={cn(inputCls, 'h-8 w-20 px-2 text-right tabular-nums')} /> : rec == null ? <span className="text-gray-400">—</span> : <span className={cn(dif ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>{qtdFmt(rec)}</span>}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(i.qtd * i.custo_ref)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {t.observacoes && <p className="border-t border-gray-100 px-4 py-2 text-[12px] text-gray-600 dark:border-gray-800 dark:text-gray-300"><b className="font-semibold text-gray-800 dark:text-gray-200">Observações:</b> {t.observacoes}</p>}
        </section>

        {t.status === 'solicitada' && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Origem: separar e despachar</p>
            <p className="mt-0.5 text-[11.5px] text-gray-600 dark:text-gray-300">Quando a mercadoria sair de {origem}, marque aqui. O destino confere ao chegar.</p>
            <div className="mt-2 flex flex-wrap gap-2"><input value={obsAcao} onChange={(e) => setObsAcao(e.target.value)} placeholder="Quem levou, horário (opcional)" className={cn(inputCls, 'h-9 max-w-sm')} /><button type="button" onClick={() => rodar('despachar', () => despacharTransferencia(t, base.autor, obsAcao.trim() || null))} disabled={!!ocupado} className={btnPrimary}>{ocupado === 'despachar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Despachar</button></div>
          </section>
        )}
        {t.status === 'em_transito' && (
          <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Destino: conferir o recebimento</p>
            {!conferindo ? (
              <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={iniciarConferencia} className={btnPrimary}><PackageCheck className="h-4 w-4" /> Conferir e receber</button><span className="self-center text-[11px] text-gray-500 dark:text-gray-400">Você ajusta a quantidade de cada item para o que chegou de fato; diferença fica no histórico.</span></div>
            ) : (
              <div className="mt-2 space-y-2"><input value={obsAcao} onChange={(e) => setObsAcao(e.target.value)} placeholder="Observação (opcional)" className={inputCls} /><div className="flex flex-wrap gap-2"><button type="button" onClick={confirmarRecebimento} disabled={ocupado === 'receber'} className={btnPrimary}>{ocupado === 'receber' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar recebimento</button><button type="button" onClick={() => setConferindo(false)} className={btnGhost}>Voltar</button></div></div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Histórico</p>
          <ol className="mt-2 space-y-1.5 text-[12px]">
            {(eventosQ.data ?? []).map((e) => <li key={e.id} className="flex gap-2"><span className="w-24 shrink-0 tabular-nums text-gray-400">{fmtDataHora(e.criado_em)}</span><span className="text-gray-700 dark:text-gray-300"><b className="font-semibold text-gray-900 dark:text-gray-100">{e.autor_nome ?? 'Alguém'}</b> {EVENTO_TRANSF_VERBO[e.tipo]}{e.detalhe ? <span className="text-gray-500 dark:text-gray-400"> · {e.detalhe}</span> : null}</span></li>)}
          </ol>
          <div className="mt-3 flex gap-2"><input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentar (fica no histórico)" className={cn(inputCls, 'h-9')} /><button type="button" disabled={!comentario.trim() || ocupado === 'comentar'} onClick={() => rodar('comentar', async () => { await comentarTransferencia(t, comentario.trim(), base.autor); setComentario('') })} className={btnGhost}>Enviar</button></div>
        </section>
      </div>
      <ModalRodape className="justify-between">
        {confirma === 'excluir' ? (
          <ConfirmaAcao perigo titulo={`Excluir o rascunho nº ${t.numero}?`} texto="Ele some da lista. Não dá para desfazer." rotulo="Excluir rascunho" ocupado={ocupado === 'excluir'}
            onVoltar={() => setConfirma(null)} onConfirmar={() => rodar('excluir', async () => { await excluirTransferencia(t); onClose() })} />
        ) : confirma === 'cancelar' ? (
          <ConfirmaAcao perigo comMotivo placeholder="Motivo do cancelamento (opcional, fica no histórico)" titulo={`Cancelar a transferência nº ${t.numero}?`} texto={t.status === 'em_transito' ? 'A mercadoria já saiu da origem: combine a volta com o posto.' : 'A origem não vai mais despachar.'} rotulo="Cancelar transferência" ocupado={ocupado === 'cancelar'}
            onVoltar={() => setConfirma(null)} onConfirmar={(m) => rodar('cancelar', async () => { await cancelarTransferencia(t, m, base.autor); setConfirma(null) })} />
        ) : (<>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(texto())}`} target="_blank" rel="noreferrer" className={btnGhost}><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          <button type="button" onClick={copiar} className={btnGhost}>{copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copiado ? 'Copiado' : 'Copiar texto'}</button>
          <ShareReportButton filename={`transferencia-${t.numero}.pdf`} build={buildPdf} label="PDF" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(t.status === 'rascunho' || t.status === 'solicitada') && <button type="button" onClick={onEditar} className={btnGhost}><Pencil className="h-4 w-4" /> Editar</button>}
          {t.status === 'rascunho' && <button type="button" onClick={() => rodar('solicitar', () => solicitarTransferencia(t, base.autor))} disabled={!!ocupado} className={btnPrimary}><Send className="h-4 w-4" /> Solicitar à origem</button>}
          {t.status === 'rascunho' && <button type="button" onClick={() => setConfirma('excluir')} disabled={!!ocupado} className={cn(btnGhost, 'text-red-600 dark:text-red-400')}><Trash2 className="h-4 w-4" /> Excluir</button>}
          {(t.status === 'solicitada' || t.status === 'em_transito') && <button type="button" onClick={() => setConfirma('cancelar')} disabled={!!ocupado} className={cn(btnGhost, 'text-red-600 dark:text-red-400')}><X className="h-4 w-4" /> Cancelar</button>}
          {t.status === 'cancelada' && <button type="button" onClick={() => rodar('reabrir', () => reabrirTransferencia(t, base.autor))} disabled={!!ocupado} className={btnGhost}><RotateCcw className="h-4 w-4" /> Reabrir como rascunho</button>}
          <button type="button" onClick={onClose} className={btnGhost}>Fechar</button>
        </div>
        </>)}
      </ModalRodape>
    </Modal>
  )
}

export default TransferenciaModal
