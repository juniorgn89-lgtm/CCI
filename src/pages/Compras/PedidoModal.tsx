import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Send, Pencil, Trash2, Check, X, RotateCcw, PackageCheck, MessageCircle, Copy, AlertTriangle, FileCheck2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { TituloPagar } from '@/api/types/financeiro'
import { todayLocal } from '@/lib/period'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import type { ReportPayload } from '@/lib/report/reportTypes'
import { Modal, ModalRodape, Erro, ConfirmaAcao } from '@/pages/Gestao/comumUi'
import {
  SETOR_LABEL, STATUS_LABEL, EVENTO_VERBO, fetchItensDoPedido, fetchEventos, enviarPedido, liberarPedido, recusarPedido, cancelarPedido, reabrirPedido, marcarRecebido, excluirRascunho, comentarPedido,
  type ItemRow, type PedidoRow, type TetoRow,
} from '@/api/supabase/compras'
import { useComprasBase, inputCls, btnPrimary, btnGhost, fmtDataHora, nomeProprio, fmtCnpj, qtdFmt } from './comum'
import { liberadoNoMes } from './hooks/usePedidos'
import { GUIAS } from '@/lib/guiasModais'
import { Selo } from './Pedidos'

/** Detalhe do pedido: itens, liberação (quem libera), ações do solicitante, nota no ERP, WhatsApp, PDF e histórico. */
const PedidoModal = ({ pedido: p, onClose, onMudou, onEditar, tetos, pedidos }: { pedido: PedidoRow; onClose: () => void; onMudou: () => void; onEditar: () => void; tetos: TetoRow[]; pedidos: PedidoRow[] }) => {
  const base = useComprasBase()
  const itensQ = useQuery({ queryKey: ['compras-itens', p.id], queryFn: () => fetchItensDoPedido(p.id) })
  const eventosQ = useQuery({ queryKey: ['compras-eventos', p.id], queryFn: () => fetchEventos(p.id) })
  const itens = itensQ.data ?? []
  const souSolicitante = !!base.userId && p.solicitante_id === base.userId
  const podeLiberar = base.podeLiberar
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [liberando, setLiberando] = useState(false)
  const [liberadas, setLiberadas] = useState<Record<string, string>>({})
  const [obsLib, setObsLib] = useState('')
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [comentario, setComentario] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [confirma, setConfirma] = useState<'excluir' | 'cancelar' | null>(null)

  // Nota lançada no ERP depois da liberação, do mesmo fornecedor e posto.
  const liberado = p.status === 'liberado' || p.status === 'liberado_parcial' || p.status === 'recebido'
  const notaQ = useQuery({
    queryKey: ['compras-nota', p.id, p.liberado_em],
    enabled: liberado && !!p.fornecedor_codigo_erp && !!p.liberado_em,
    staleTime: 5 * 60_000,
    queryFn: () => fetchAllPages((q) => fetchTitulosPagar({ dataInicial: p.liberado_em!.slice(0, 10), dataFinal: todayLocal(), fornecedorCodigo: p.fornecedor_codigo_erp!, empresaCodigo: p.empresa_codigo, apenasPendente: false, ultimoCodigo: q.ultimoCodigo, limite: q.limite }), 200, 2),
  })
  const notas = ((notaQ.data ?? []) as TituloPagar[])
  const notaDetectada = notas.length > 0 ? notas.reduce((m, t) => (t.dataMovimento < m.dataMovimento ? t : m), notas[0]) : null

  const teto = tetos.find((t) => t.empresa_codigo === p.empresa_codigo && t.setor === p.setor)?.valor_mensal ?? 0
  const usadoMes = liberadoNoMes(pedidos, p.empresa_codigo, p.setor, p.id)
  const totalLib = itens.reduce((s, i) => s + Math.max(0, Number(liberadas[i.id] ?? i.qtd_solicitada) || 0) * i.custo_unit, 0)
  const estoura = teto > 0 && usadoMes + (liberando ? totalLib : p.total_solicitado) > teto

  const rodar = async (chave: string, fn: () => Promise<unknown>) => {
    setErro(null); setOcupado(chave)
    try { await fn(); onMudou() } catch (e) { setErro((e as Error).message) } finally { setOcupado(null) }
  }
  const iniciarLiberacao = () => { setLiberadas(Object.fromEntries(itens.map((i) => [i.id, String(i.qtd_solicitada)]))); setLiberando(true); setRecusando(false) }
  const confirmarLiberacao = () => rodar('liberar', async () => { await liberarPedido(p, itens, Object.fromEntries(Object.entries(liberadas).map(([k, v]) => [k, Number(v.replace(',', '.')) || 0])), base.autor, obsLib.trim() || null); setLiberando(false) })
  const confirmarRecusa = () => { if (!motivo.trim()) { setErro('Diga o motivo da recusa: o solicitante precisa saber o que ajustar.'); return } rodar('recusar', async () => { await recusarPedido(p, motivo.trim(), base.autor); setRecusando(false) }) }

  const textoWhats = () => {
    const linhas = itens.map((i) => `• ${qtdFmt(i.qtd_liberada ?? i.qtd_solicitada)}${i.unidade ? ` ${i.unidade.toLowerCase()}` : ''} — ${nomeProprio(i.produto_nome)}`)
    return [`*Pedido de compra nº ${p.numero}* · ${base.nomePosto(p.empresa_codigo)}`, `Fornecedor: ${nomeProprio(p.fornecedor_nome)}${p.fornecedor_cnpj ? ` (${fmtCnpj(p.fornecedor_cnpj)})` : ''}`, '', ...linhas, '', `Total: ${formatCurrency(p.total_liberado ?? p.total_solicitado)}`, p.observacoes ? `Obs.: ${p.observacoes}` : '', `Solicitante: ${p.solicitante_nome ?? ''}`].filter((l) => l !== null).join('\n')
  }
  const copiar = () => { navigator.clipboard?.writeText(textoWhats()).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }, () => {}) }
  const buildPdf = (): ReportPayload => ({
    title: `Pedido de compra nº ${p.numero}`,
    subtitle: `${base.nomePosto(p.empresa_codigo)} · ${nomeProprio(p.fornecedor_nome)} · ${STATUS_LABEL[p.status]} · ${SETOR_LABEL[p.setor]}`,
    kpis: [
      { label: 'Solicitado', value: formatCurrencyInt(p.total_solicitado) },
      { label: 'Liberado', value: p.total_liberado != null ? formatCurrencyInt(p.total_liberado) : '—', tone: p.total_liberado != null ? 'pos' : 'neutral' },
      { label: 'Itens', value: String(itens.length) },
      { label: 'Solicitante', value: p.solicitante_nome ?? '—' },
    ],
    sections: [
      { title: 'Itens', rows: itens.map((i) => ({ label: `${nomeProprio(i.produto_nome)} · ${qtdFmt(i.qtd_solicitada)}${i.unidade ? ` ${i.unidade.toLowerCase()}` : ''}${i.qtd_liberada != null && i.qtd_liberada !== i.qtd_solicitada ? ` (liberado ${qtdFmt(i.qtd_liberada)})` : ''} × ${formatCurrency(i.custo_unit)}`, value: formatCurrency((i.qtd_liberada ?? i.qtd_solicitada) * i.custo_unit), sub: i.justificativa ?? undefined })) },
      ...(p.observacoes ? [{ title: 'Observações', rows: [{ label: p.observacoes, value: '' }] }] : []),
      ...(p.motivo_recusa ? [{ title: 'Motivo da recusa', rows: [{ label: p.motivo_recusa, value: '' }] }] : []),
      { title: 'Histórico', rows: (eventosQ.data ?? []).map((e) => ({ label: `${e.autor_nome ?? 'Alguém'} ${EVENTO_VERBO[e.tipo]}`, value: fmtDataHora(e.criado_em), sub: e.detalhe ?? undefined })) },
    ],
    footnote: 'Visor360 · pedido interno de compra; a nota entra no ERP pelo fluxo normal.',
  })

  const Info = ({ k, v }: { k: string; v: React.ReactNode }) => <div><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{k}</p><p className="text-[12.5px] text-gray-800 dark:text-gray-200">{v}</p></div>

  return (
    <Modal guia={GUIAS.pedido} fundo="" open onClose={onClose} titulo={<span className="inline-flex flex-wrap items-center gap-3">Pedido nº {p.numero} <Selo status={p.status} /></span>} descricao={`Criado em ${fmtDataHora(p.criado_em)}${p.enviado_em ? ` · enviado em ${fmtDataHora(p.enviado_em)}` : ''}${p.liberado_em ? ` · ${p.status === 'recusado' ? 'recusado' : 'liberado'} em ${fmtDataHora(p.liberado_em)} por ${p.liberador_nome ?? ''}` : ''}`} largura="max-w-4xl">
      <div className="space-y-4">
        <Erro msg={erro} />
        <div className="grid gap-3 rounded-xl border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700">
          <Info k="Posto" v={base.nomePosto(p.empresa_codigo)} />
          <Info k="Fornecedor" v={<>{nomeProprio(p.fornecedor_nome)}{p.fornecedor_cnpj ? <span className="block text-[10.5px] text-gray-400">{fmtCnpj(p.fornecedor_cnpj)}</span> : null}</>} />
          <Info k="Setor" v={SETOR_LABEL[p.setor]} />
          <Info k="Solicitante" v={p.solicitante_nome ?? '—'} />
        </div>

        {notaDetectada && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[12px] text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"><FileCheck2 className="h-4 w-4" /> Nota lançada no ERP: título {notaDetectada.numeroTitulo || `#${notaDetectada.tituloPagarCodigo}`} de {formatCurrency(notaDetectada.valor)} em {fmtDataHora(notaDetectada.dataMovimento)}.</p>
        )}
        {liberado && !notaDetectada && !notaQ.isLoading && p.fornecedor_codigo_erp && <p className="text-[11px] text-gray-400">Ainda não apareceu nota deste fornecedor para este posto no ERP depois da liberação. O aviso é automático quando aparecer.</p>}
        {p.motivo_recusa && p.status === 'recusado' && <p className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-[12px] text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"><b className="font-semibold">Motivo da recusa:</b> {p.motivo_recusa}</p>}
        {teto > 0 && (
          <p className={cn('inline-flex items-center gap-2 text-[11.5px]', estoura ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400')}>
            {estoura && <AlertTriangle className="h-3.5 w-3.5" />}Teto do mês em {SETOR_LABEL[p.setor].toLowerCase()} neste posto: {formatCurrencyInt(teto)} · já liberado {formatCurrencyInt(usadoMes)}{estoura ? ` · este pedido passa do teto (${formatCurrencyInt(usadoMes + (liberando ? totalLib : p.total_solicitado))}).` : '.'}
          </p>
        )}

        {/* Itens */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700">
          <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Itens ({itens.length})</p>
            <span className="ml-auto text-[12px] tabular-nums text-gray-600 dark:text-gray-300">Solicitado <b className="font-semibold text-gray-900 dark:text-white">{formatCurrency(p.total_solicitado)}</b>{p.total_liberado != null ? <> · Liberado <b className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(p.total_liberado)}</b></> : null}{liberando ? <> · Liberando <b className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalLib)}</b></> : null}</span>
          </header>
          {itensQ.isLoading ? <p className="inline-flex items-center gap-2 px-4 py-3 text-[12px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="px-4 py-1.5 text-left font-semibold">Produto</th><th className="px-2 py-1.5 text-right font-semibold">Solicitado</th><th className="px-2 py-1.5 text-right font-semibold">Liberado</th><th className="px-2 py-1.5 text-right font-semibold">Custo un.</th><th className="px-4 py-1.5 text-right font-semibold">Subtotal</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {itens.map((i: ItemRow) => {
                    const lib = liberando ? (Number((liberadas[i.id] ?? '').replace(',', '.')) || 0) : i.qtd_liberada
                    const cortado = lib != null && lib < i.qtd_solicitada
                    return (
                      <tr key={i.id} className={cn(lib === 0 && 'opacity-60')}>
                        <td className="px-4 py-1.5"><p className="font-medium text-gray-900 dark:text-gray-100">{nomeProprio(i.produto_nome)}</p>{i.justificativa && <p className="text-[10.5px] text-gray-400">{i.justificativa}</p>}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{qtdFmt(i.qtd_solicitada)}{i.unidade ? <span className="text-[10px] text-gray-400"> {i.unidade.toLowerCase()}</span> : null}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {liberando ? <input inputMode="decimal" value={liberadas[i.id] ?? ''} onChange={(e) => setLiberadas({ ...liberadas, [i.id]: e.target.value })} className={cn(inputCls, 'h-8 w-20 px-2 text-right tabular-nums')} />
                            : lib == null ? <span className="text-gray-400">—</span> : <span className={cn(cortado ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>{qtdFmt(lib)}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(i.custo_unit)}</td>
                        <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency((lib ?? i.qtd_solicitada) * i.custo_unit)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {p.observacoes && <p className="border-t border-gray-100 px-4 py-2 text-[12px] text-gray-600 dark:border-gray-800 dark:text-gray-300"><b className="font-semibold text-gray-800 dark:text-gray-200">Observações:</b> {p.observacoes}</p>}
        </section>

        {/* Liberação */}
        {podeLiberar && p.status === 'aguardando' && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Liberação</p>
            {!liberando && !recusando && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={iniciarLiberacao} className={btnPrimary}><Check className="h-4 w-4" /> Liberar</button>
                <button type="button" onClick={() => { setRecusando(true); setLiberando(false) }} className={btnGhost}><X className="h-4 w-4" /> Recusar</button>
                <span className="self-center text-[11px] text-gray-500 dark:text-gray-400">Ao liberar você pode ajustar a quantidade de cada item; quantidade menor vira liberação parcial, zero corta o item.</span>
              </div>
            )}
            {liberando && (
              <div className="mt-2 space-y-2">
                <input value={obsLib} onChange={(e) => setObsLib(e.target.value)} placeholder="Observação para o solicitante (opcional)" className={inputCls} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={confirmarLiberacao} disabled={ocupado === 'liberar'} className={btnPrimary}>{ocupado === 'liberar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar liberação de {formatCurrency(totalLib)}</button>
                  <button type="button" onClick={() => setLiberando(false)} className={btnGhost}>Voltar</button>
                </div>
              </div>
            )}
            {recusando && (
              <div className="mt-2 space-y-2">
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo da recusa (o solicitante vai ler)" className={inputCls} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={confirmarRecusa} disabled={ocupado === 'recusar'} className={cn(btnPrimary, 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700')}>{ocupado === 'recusar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Confirmar recusa</button>
                  <button type="button" onClick={() => setRecusando(false)} className={btnGhost}>Voltar</button>
                </div>
              </div>
            )}
          </section>
        )}
        {!podeLiberar && p.status === 'aguardando' && <p className="text-[12px] text-gray-500 dark:text-gray-400">Aguardando quem libera. Você pode editar ou cancelar enquanto isso.</p>}

        {/* Histórico + comentário */}
        <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Histórico</p>
          <ol className="mt-2 space-y-1.5 text-[12px]">
            {(eventosQ.data ?? []).map((e) => (
              <li key={e.id} className="flex gap-2"><span className="w-24 shrink-0 tabular-nums text-gray-400">{fmtDataHora(e.criado_em)}</span><span className="text-gray-700 dark:text-gray-300"><b className="font-semibold text-gray-900 dark:text-gray-100">{e.autor_nome ?? 'Alguém'}</b> {EVENTO_VERBO[e.tipo]}{e.detalhe ? <span className="text-gray-500 dark:text-gray-400"> · {e.detalhe}</span> : null}</span></li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentar (fica no histórico)" className={cn(inputCls, 'h-9')} onKeyDown={(e) => { if (e.key === 'Enter' && comentario.trim()) rodar('comentar', async () => { await comentarPedido(p, comentario.trim(), base.autor); setComentario('') }) }} />
            <button type="button" disabled={!comentario.trim() || ocupado === 'comentar'} onClick={() => rodar('comentar', async () => { await comentarPedido(p, comentario.trim(), base.autor); setComentario('') })} className={btnGhost}>Enviar</button>
          </div>
        </section>
      </div>

      <ModalRodape className="justify-between">
        {confirma === 'excluir' ? (
          <ConfirmaAcao perigo titulo={`Excluir o rascunho nº ${p.numero}?`} texto="Ele some da lista. Não dá para desfazer." rotulo="Excluir rascunho" ocupado={ocupado === 'excluir'}
            onVoltar={() => setConfirma(null)} onConfirmar={() => rodar('excluir', async () => { await excluirRascunho(p); onClose() })} />
        ) : confirma === 'cancelar' ? (
          <ConfirmaAcao perigo comMotivo placeholder="Motivo do cancelamento (opcional, fica no histórico)" titulo={`Cancelar o pedido nº ${p.numero}?`} texto={p.status === 'aguardando' ? 'Ele sai da fila de liberação.' : 'Ele já foi liberado: avise o fornecedor se o pedido já foi mandado.'} rotulo="Cancelar pedido" ocupado={ocupado === 'cancelar'}
            onVoltar={() => setConfirma(null)} onConfirmar={(m) => rodar('cancelar', async () => { await cancelarPedido(p, m, base.autor); setConfirma(null) })} />
        ) : (<>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(textoWhats())}`} target="_blank" rel="noreferrer" className={btnGhost} title="Abre o WhatsApp com o pedido pronto para mandar ao fornecedor"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          <button type="button" onClick={copiar} className={btnGhost}>{copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copiado ? 'Copiado' : 'Copiar texto'}</button>
          <ShareReportButton filename={`pedido-${p.numero}.pdf`} build={buildPdf} label="PDF" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(souSolicitante || podeLiberar) && (p.status === 'rascunho' || p.status === 'aguardando') && <button type="button" onClick={onEditar} className={btnGhost}><Pencil className="h-4 w-4" /> Editar</button>}
          {souSolicitante && p.status === 'rascunho' && <button type="button" onClick={() => rodar('enviar', () => enviarPedido(p, base.autor))} disabled={!!ocupado} className={btnPrimary}><Send className="h-4 w-4" /> Enviar para liberação</button>}
          {(souSolicitante || podeLiberar) && p.status === 'rascunho' && <button type="button" onClick={() => setConfirma('excluir')} disabled={!!ocupado} className={cn(btnGhost, 'text-red-600 dark:text-red-400')}><Trash2 className="h-4 w-4" /> Excluir</button>}
          {(souSolicitante || podeLiberar) && (p.status === 'aguardando' || p.status === 'liberado' || p.status === 'liberado_parcial') && <button type="button" onClick={() => setConfirma('cancelar')} disabled={!!ocupado} className={cn(btnGhost, 'text-red-600 dark:text-red-400')}><X className="h-4 w-4" /> Cancelar pedido</button>}
          {(souSolicitante || podeLiberar) && (p.status === 'liberado' || p.status === 'liberado_parcial') && <button type="button" onClick={() => rodar('receber', () => marcarRecebido(p, base.autor))} disabled={!!ocupado} className={btnPrimary}><PackageCheck className="h-4 w-4" /> Marcar como recebido</button>}
          {(souSolicitante || podeLiberar) && p.status === 'recusado' && <button type="button" onClick={() => rodar('reabrir', () => reabrirPedido(p, base.autor))} disabled={!!ocupado} className={btnGhost}><RotateCcw className="h-4 w-4" /> Reabrir como rascunho</button>}
          <button type="button" onClick={onClose} className={btnGhost}>Fechar</button>
        </div>
        </>)}
      </ModalRodape>
    </Modal>
  )
}

export default PedidoModal
