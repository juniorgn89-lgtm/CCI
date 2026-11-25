import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Send, Pencil, Trash2, Check, X, RotateCcw, Undo2, PackageCheck, MessageCircle, Copy, AlertTriangle, FileCheck2, Receipt, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { TituloPagar } from '@/api/types/financeiro'
import { todayLocal } from '@/lib/period'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import BalaoAcao from '@/components/ui/BalaoAcao'
import InfoHint from '@/components/ui/InfoHint'
import type { ReportPayload } from '@/lib/report/reportTypes'
import { Modal, ModalRodape, Erro, ConfirmaAcao } from '@/pages/Gestao/comumUi'
import {
  SETOR_LABEL, STATUS_LABEL, EVENTO_VERBO, fetchItensDoPedido, fetchEventos, enviarPedido, liberarPedido, recusarPedido, cancelarPedido, desfazerLiberacao, desfazerRecebimento, reabrirPedido, marcarRecebido, excluirRascunho, comentarPedido,
  type ItemRow, type PedidoRow, type TetoRow,
  encerrarRecebimento, fetchNotasDoPedido, SITUACAO_NOTA_LABEL, type PedidoNotaRow,
} from '@/api/supabase/compras'
import { useComprasBase, inputCls, btnPrimary, btnGhost, fmtDataHora, nomeProprio, fmtCnpj, qtdFmt } from './comum'
import { liberadoNoMes } from './hooks/usePedidos'
import { GUIAS } from '@/lib/guiasModais'
import { Selo } from './Pedidos'

/** Detalhe do pedido: itens, liberação (quem libera), ações do solicitante, nota no ERP, WhatsApp, PDF e histórico. */
const PedidoModal = ({ pedido: p, onClose, onMudou, onEditar, tetos, pedidos }: { pedido: PedidoRow; onClose: () => void; onMudou: () => void; onEditar: () => void; tetos: TetoRow[]; pedidos: PedidoRow[] }) => {
  const base = useComprasBase()
  const itensQ = useQuery({ queryKey: ['compras-itens', p.id], queryFn: () => fetchItensDoPedido(p.id) })
  const eventosQ = useQuery({ queryKey: ['compras-eventos', p.id, p.status], queryFn: () => fetchEventos(p.id) })
  const itens = itensQ.data ?? []
  const souSolicitante = !!base.userId && p.solicitante_id === base.userId
  const podeLiberar = base.podeLiberar
  const podeDesfazer = base.podeDesfazer
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [liberando, setLiberando] = useState(false)
  const [liberadas, setLiberadas] = useState<Record<string, string>>({})
  const [obsLib, setObsLib] = useState('')
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [comentario, setComentario] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [confirma, setConfirma] = useState<'excluir' | 'cancelar' | 'encerrar' | 'desfazer' | 'desfazerReceb' | null>(null)

  // Nota lançada no ERP depois da liberação, do mesmo fornecedor e posto.
  const liberado = p.status === 'liberado' || p.status === 'liberado_parcial' || p.status === 'recebido_parcial' || p.status === 'recebido'
  // Notas vinculadas pelo recebimento no NotaOK (um pedido pode ter várias).
  const nfsQ = useQuery({ queryKey: ['compras-pedido-notas', p.id, p.status], enabled: liberado, queryFn: () => fetchNotasDoPedido(p.id) })
  const nfs: PedidoNotaRow[] = nfsQ.data ?? []
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
      { label: 'Valor solicitado', value: formatCurrencyInt(p.total_solicitado) },
      { label: 'Valor liberado', value: p.total_liberado != null ? formatCurrencyInt(p.total_liberado) : '—', tone: p.total_liberado != null ? 'pos' : 'neutral' },
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
    <Modal guia={GUIAS.pedido} fundo="" open onClose={onClose} titulo={<span className="inline-flex flex-wrap items-center gap-3">Pedido nº {p.numero} <Selo status={p.status} /></span>} descricao={`Criado em ${fmtDataHora(p.criado_em)}${p.enviado_em ? ` · enviado em ${fmtDataHora(p.enviado_em)}` : ''}${p.liberado_em ? ` · ${p.status === 'recusado' ? 'recusado' : 'liberado'} em ${fmtDataHora(p.liberado_em)} por ${p.liberador_nome ?? ''}` : ''}`} largura="max-w-6xl">
      <div className="space-y-4">
        <Erro msg={erro} />
        <div className="grid gap-3 rounded-xl border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700">
          <Info k="Posto" v={base.nomePosto(p.empresa_codigo)} />
          <Info k="Fornecedor" v={<>{nomeProprio(p.fornecedor_nome)}{p.fornecedor_cnpj ? <span className="block text-[10.5px] text-gray-400">{fmtCnpj(p.fornecedor_cnpj)}</span> : null}</>} />
          <Info k="Setor" v={SETOR_LABEL[p.setor]} />
          <Info k="Solicitante" v={p.solicitante_nome ?? '—'} />
        </div>

        {nfs.length === 0 && notaDetectada && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[12px] text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"><FileCheck2 className="h-4 w-4" /> Nota lançada no ERP: título {notaDetectada.numeroTitulo || `#${notaDetectada.tituloPagarCodigo}`} de {formatCurrency(notaDetectada.valor)} em {fmtDataHora(notaDetectada.dataMovimento)}.</p>
        )}
        {liberado && nfs.length === 0 && !notaDetectada && !notaQ.isLoading && p.fornecedor_codigo_erp && <p className="text-[11px] text-gray-400">Ainda não apareceu nota deste fornecedor para este posto no ERP depois da liberação. O aviso é automático quando aparecer.</p>}
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
                <thead className="text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="w-20 py-1.5 pl-4 pr-2 text-left font-semibold">Código</th><th className="px-2 py-1.5 text-left font-semibold">Produto</th><th className="px-2 py-1.5 text-right font-semibold">Qtd. solicitada</th><th className="px-2 py-1.5 text-right font-semibold">Qtd. liberada</th><th className="px-2 py-1.5 text-right font-semibold">Custo un.</th><th className="px-4 py-1.5 text-right font-semibold">Subtotal</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {itens.map((i: ItemRow) => {
                    const lib = liberando ? (Number((liberadas[i.id] ?? '').replace(',', '.')) || 0) : i.qtd_liberada
                    const cortado = lib != null && lib < i.qtd_solicitada
                    return (
                      <tr key={i.id} className={cn(lib === 0 && 'opacity-60')}>
                        <td className="py-1.5 pl-4 pr-2 align-top tabular-nums text-gray-500 dark:text-gray-400">{i.produto_codigo}</td>
                        <td className="px-2 py-1.5"><p className="font-medium text-gray-900 dark:text-gray-100">{nomeProprio(i.produto_nome)}</p>{i.justificativa && <p className="text-[10.5px] text-gray-400">{i.justificativa}</p>}</td>
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

        {/* Notas fiscais (vinculadas no NotaOK pelo recebimento) */}
        {nfs.length > 0 && (
          <section className="rounded-xl border border-gray-200 dark:border-gray-700">
            <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
              <Receipt className="h-4 w-4 text-gray-400" />
              <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Notas fiscais ({nfs.length})</p>
              <InfoHint text="Notas que o recebimento ligou a este pedido no NotaOK, ao conferir a mercadoria. Um pedido pode chegar em várias notas: enquanto faltar, ele fica como Recebido parcial." />
              <span className="ml-auto text-[12px] tabular-nums text-gray-600 dark:text-gray-300">Total das notas <b className="font-semibold text-gray-900 dark:text-white">{formatCurrency(nfs.reduce((t, n) => t + (n.nota_valor ?? 0), 0))}</b></span>
            </header>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {nfs.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-[12.5px]">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">NF {n.nota_numero ?? n.nota_chave.slice(25, 34)}{n.nota_serie != null ? <span className="font-normal text-gray-400"> / {n.nota_serie}</span> : null}</span>
                  <span className="tabular-nums text-gray-700 dark:text-gray-300">{n.nota_valor != null ? formatCurrency(n.nota_valor) : '—'}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold', n.situacao === 'lancada' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : n.situacao === 'devolvida' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300')}>{SITUACAO_NOTA_LABEL[n.situacao]}</span>
                  {n.completa && <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">completou o pedido</span>}
                  <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">{n.nota_emissao ? `emitida ${n.nota_emissao.split('-').reverse().join('/')} · ` : ''}recebida por {n.vinculado_por_nome ?? 'recebimento'} em {fmtDataHora(n.vinculado_em)}{n.lancada_em ? ` · lançada ${fmtDataHora(n.lancada_em)}` : ''}</span>
                  {n.situacao === 'devolvida' && <DevolucaoBox n={n} />}
                </li>
              ))}
            </ul>
            {p.status === 'recebido_parcial' && <p className="border-t border-gray-100 px-4 py-2 text-[11.5px] text-gray-500 dark:border-gray-800 dark:text-gray-400">Ainda falta chegar parte do pedido. Se o fornecedor não vai mandar o resto, use “Encerrar recebimento”.</p>}
          </section>
        )}

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
          <ConfirmaAcao perigo comMotivo motivoObrigatorio placeholder="Por que está cancelando? (obrigatório, fica no histórico)" titulo={`Cancelar o pedido nº ${p.numero}?`} texto="Ele sai da fila de liberação e não pode ser reaberto." rotulo="Cancelar pedido" ocupado={ocupado === 'cancelar'}
            onVoltar={() => setConfirma(null)} onConfirmar={(m) => rodar('cancelar', async () => { await cancelarPedido(p, m, base.autor); setConfirma(null) })} />
        ) : confirma === 'desfazer' ? (
          <ConfirmaAcao comMotivo motivoObrigatorio placeholder="O que está errado no pedido? (obrigatório, fica no histórico)" titulo={`Desfazer a liberação do pedido nº ${p.numero}?`} texto="Ele volta para Aguardando liberação: dá para editar, liberar de novo ou cancelar. O valor sai do teto do mês. Se o pedido já foi mandado ao fornecedor, avise-o." rotulo="Desfazer liberação" ocupado={ocupado === 'desfazer'}
            onVoltar={() => setConfirma(null)} onConfirmar={(m) => rodar('desfazer', async () => { await desfazerLiberacao(p, m ?? '', base.autor); setConfirma(null) })} />
        ) : confirma === 'desfazerReceb' ? (
          <ConfirmaAcao comMotivo motivoObrigatorio placeholder="Por que o recebimento está sendo desfeito? (obrigatório, fica no histórico)" titulo={`Desfazer o recebimento do pedido nº ${p.numero}?`} texto="Ele volta para Liberado (aguardando entrega). Use quando marcaram como recebido por engano." rotulo="Desfazer recebimento" ocupado={ocupado === 'desfazerReceb'}
            onVoltar={() => setConfirma(null)} onConfirmar={(m) => rodar('desfazerReceb', async () => { await desfazerRecebimento(p, m ?? '', base.autor); setConfirma(null) })} />
        ) : confirma === 'encerrar' ? (
          <ConfirmaAcao comMotivo placeholder="Motivo (opcional, fica no histórico). Ex.: fornecedor sem estoque do resto" titulo={`Encerrar o recebimento do pedido nº ${p.numero}?`} texto="O pedido passa a Recebido com as notas que chegaram até agora." rotulo="Encerrar recebimento" ocupado={ocupado === 'encerrar'}
            onVoltar={() => setConfirma(null)} onConfirmar={(m) => rodar('encerrar', async () => { await encerrarRecebimento(p, base.autor, m); setConfirma(null) })} />
        ) : (<>
        <div className="flex flex-wrap gap-2">
          <BalaoAcao texto="Abre o WhatsApp com o pedido já escrito (itens, quantidades e total). Você escolhe o contato, normalmente o vendedor do fornecedor, e envia."><a href={`https://wa.me/?text=${encodeURIComponent(textoWhats())}`} target="_blank" rel="noreferrer" className={btnGhost}><MessageCircle className="h-4 w-4" /> WhatsApp</a></BalaoAcao>
          <BalaoAcao texto="Copia o mesmo texto do WhatsApp (itens, quantidades e total) para você colar onde quiser: e-mail, site ou sistema do fornecedor."><button type="button" onClick={copiar} className={btnGhost}>{copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copiado ? 'Copiado' : 'Copiar texto'}</button></BalaoAcao>
          <BalaoAcao texto="Gera o pedido em PDF, com cara de documento, para imprimir, arquivar ou mandar ao fornecedor. Abre uma prévia: dali você compartilha ou baixa o arquivo."><ShareReportButton filename={`pedido-${p.numero}.pdf`} build={buildPdf} label="PDF" /></BalaoAcao>
        </div>
        <div className="flex flex-wrap gap-2">
          {(souSolicitante || podeLiberar) && (p.status === 'rascunho' || p.status === 'aguardando') && <button type="button" onClick={onEditar} className={btnGhost}><Pencil className="h-4 w-4" /> Editar</button>}
          {souSolicitante && p.status === 'rascunho' && <button type="button" onClick={() => rodar('enviar', () => enviarPedido(p, base.autor))} disabled={!!ocupado} className={btnPrimary}><Send className="h-4 w-4" /> Enviar para liberação</button>}
          {(souSolicitante || podeLiberar) && p.status === 'rascunho' && <button type="button" onClick={() => setConfirma('excluir')} disabled={!!ocupado} className={cn(btnGhost, 'text-red-600 dark:text-red-400')}><Trash2 className="h-4 w-4" /> Excluir</button>}
          {podeDesfazer && p.status === 'recebido' && nfs.length === 0 && <button type="button" onClick={() => setConfirma('desfazerReceb')} disabled={!!ocupado || nfsQ.isLoading} className={btnGhost}><Undo2 className="h-4 w-4" /> Desfazer recebimento</button>}
          {podeDesfazer && (p.status === 'liberado' || p.status === 'liberado_parcial') && nfs.length === 0 && <button type="button" onClick={() => setConfirma('desfazer')} disabled={!!ocupado || nfsQ.isLoading} className={btnGhost}><Undo2 className="h-4 w-4" /> Desfazer liberação</button>}
          {/* Liberado: cancelar exige desfazer a liberação antes (só quem libera). Botão travado explica o porquê. */}
          {podeDesfazer && (p.status === 'liberado' || p.status === 'liberado_parcial') && nfs.length > 0 && (
            <BalaoAcao texto="Este pedido já tem nota ligada pelo NotaOK. Para desfazer a liberação, tire a nota do pedido no NotaOK antes."><button type="button" disabled className={cn(btnGhost, 'opacity-50')}><Undo2 className="h-4 w-4" /> Desfazer liberação</button></BalaoAcao>
          )}
          {!podeDesfazer && (souSolicitante || podeLiberar) && (p.status === 'liberado' || p.status === 'liberado_parcial') && (
            <BalaoAcao texto="O pedido já foi liberado. Para cancelar, um supervisor precisa primeiro desfazer a liberação."><button type="button" disabled className={cn(btnGhost, 'text-red-600 opacity-50 dark:text-red-400')}><X className="h-4 w-4" /> Cancelar pedido</button></BalaoAcao>
          )}
          {(souSolicitante || podeLiberar) && p.status === 'aguardando' && <button type="button" onClick={() => setConfirma('cancelar')} disabled={!!ocupado} className={cn(btnGhost, 'text-red-600 dark:text-red-400')}><X className="h-4 w-4" /> Cancelar pedido</button>}
          {(souSolicitante || podeLiberar) && (p.status === 'liberado' || p.status === 'liberado_parcial') && <button type="button" onClick={() => rodar('receber', () => marcarRecebido(p, base.autor))} disabled={!!ocupado} className={btnPrimary}><PackageCheck className="h-4 w-4" /> Marcar como recebido</button>}
          {(souSolicitante || podeLiberar) && p.status === 'recebido_parcial' && <button type="button" onClick={() => setConfirma('encerrar')} disabled={!!ocupado} className={btnGhost}><Flag className="h-4 w-4" /> Encerrar recebimento</button>}
          {(souSolicitante || podeLiberar) && p.status === 'recusado' && <button type="button" onClick={() => rodar('reabrir', () => reabrirPedido(p, base.autor))} disabled={!!ocupado} className={btnGhost}><RotateCcw className="h-4 w-4" /> Reabrir como rascunho</button>}
          <button type="button" onClick={onClose} className={btnGhost}>Fechar</button>
        </div>
        </>)}
      </ModalRodape>
    </Modal>
  )
}

/** O que o escritório apontou ao devolver a nota no NotaOK. */
const DevolucaoBox = ({ n }: { n: PedidoNotaRow }) => {
  const d = n.devolucao
  const linhas = d ? [d.geral && { r: 'Observação', t: d.geral }, d.nf && { r: 'Nota fiscal', t: d.nf }, d.boleto && { r: 'Boletos', t: d.boleto }].filter((x): x is { r: string; t: string } => !!x) : []
  return (
    <div className="mt-1.5 w-full rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-[12px] text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
      <p className="font-semibold">Devolvida para correção{n.devolvida_por_nome ? ` por ${n.devolvida_por_nome}` : ''}{n.devolvida_em ? ` em ${fmtDataHora(n.devolvida_em)}` : ''}</p>
      {!d ? <p className="text-red-800/80 dark:text-red-200/80">O motivo está no NotaOK, na própria nota.</p> : (
        <ul className="mt-1 space-y-0.5">
          {linhas.map((l) => <li key={l.r}><span className="font-semibold">{l.r}:</span> {l.t}</li>)}
          {d.itens.map((i, k) => <li key={k}><span className="font-mono text-[11px] text-red-700/80 dark:text-red-300/80">{i.codigo ?? 'sem código'}</span> {i.descricao ?? 'Item'}: {i.motivo}</li>)}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-red-800/70 dark:text-red-200/70">Se o erro é do fornecedor (preço, item ou quantidade), fale com ele. A nota continua ligada a este pedido.</p>
    </div>
  )
}

export default PedidoModal
