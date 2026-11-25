import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import RowActionButton from '@/components/tables/RowAction'
import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { CabecalhoFiltro, AvisoFiltros } from '@/components/tables/FiltroColuna'
import { useFiltrosColuna, type DefColuna } from '@/lib/filtroColuna'
import { fetchNotasNotaok, fetchPedidosPorNota, NOTAOK_URL, STATUS_NOTAOK, type NotaOkRow, type PedidoDaNota, type StatusNotaOk } from '@/api/supabase/notaokNotas'
import { useComprasBase, containerCls, inputCls, btnGhost, fmtDataHora, fmtData, nomeProprio } from './comum'
import { usePedidos } from './hooks/usePedidos'
import PedidoModal from './PedidoModal'

type Aba = StatusNotaOk | 'todas'
// Na ordem do caminho da nota (como no NotaOK). Lançadas não aparecem.
const ABAS: { id: Aba; label: string }[] = [
  { id: 'pendente', label: 'A conferir' },
  { id: 'em_preenchimento', label: 'Em conferência' },
  { id: 'enviada', label: 'Aguardando lançamento' },
  { id: 'devolvida', label: 'Devolvidas' },
  { id: 'todas', label: 'Todas' },
]
const DIAS_ALERTA = 2

const diasDesde = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null)
const textoDias = (d: number | null) => (d == null ? '—' : d === 0 ? 'hoje' : d === 1 ? '1 dia' : `${d} dias`)
const rotuloPedido = (n: NotaOkRow, porNota: Map<string, PedidoDaNota[]>) => {
  const l = porNota.get(n.nota_chave)
  if (l?.length) return l.map((p) => `Nº ${p.numero ?? '?'}`).join(', ')
  return n.sem_pedido ? 'Sem pedido' : 'Não ligada'
}
const nfDe = (n: NotaOkRow) => (n.numero != null ? `${n.numero}${n.serie != null ? `-${n.serie}` : ''}` : n.nota_chave.slice(25, 34))

/** Compras › Notas recebidas: as notas do NotaOK que ainda não foram lançadas no ERP. */
const NotasRecebidas = () => {
  const base = useComprasBase()
  const notasQ = useQuery({
    queryKey: ['notaok-notas', base.redeId],
    queryFn: () => fetchNotasNotaok(base.redeId!),
    enabled: !!base.redeId,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  })
  const pedidosQ = useQuery({ queryKey: ['notaok-notas-pedidos', base.redeId], queryFn: () => fetchPedidosPorNota(base.redeId!), enabled: !!base.redeId, staleTime: 60_000 })
  const { pedidos, tetos, invalidar } = usePedidos(base.redeId)
  const [abaEscolhida, setAba] = useState<Aba | null>(null)
  const [busca, setBusca] = useState('')
  const [pedidoAberto, setPedidoAberto] = useState<string | null>(null)

  const notas = useMemo(() => notasQ.data ?? [], [notasQ.data])
  const porNota = useMemo(() => pedidosQ.data ?? new Map<string, PedidoDaNota[]>(), [pedidosQ.data])

  const colunas = useMemo((): Record<'nf' | 'posto' | 'fornecedor' | 'situacao' | 'parada' | 'pedido' | 'quem' | 'emissao', DefColuna<NotaOkRow>> => ({
    nf: nfDe,
    posto: (n) => base.nomePosto(n.empresa_codigo),
    fornecedor: (n) => nomeProprio(n.fornecedor_nome ?? '—'),
    situacao: (n) => STATUS_NOTAOK[n.status].rotulo,
    pedido: (n) => rotuloPedido(n, porNota),
    quem: (n) => n.por_nome ?? '',
    parada: { valor: (n) => textoDias(diasDesde(n.desde)), ordem: (n) => String(diasDesde(n.desde) ?? 9999).padStart(5, '0') },
    emissao: { valor: (n) => (n.emissao ? fmtData(n.emissao) : ''), ordem: (n) => n.emissao ?? '' },
  }), [base, porNota])
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return notas.filter((n) => {
      if (t && !((n.fornecedor_nome ?? '').toLowerCase().includes(t) || String(n.numero ?? '') === t || base.nomePosto(n.empresa_codigo).toLowerCase().includes(t))) return false
      return true
    })
  }, [notas, busca, base])
  const fc = useFiltrosColuna(filtradas, colunas)
  const naAba = (n: NotaOkRow, a: Aba) => a === 'todas' || n.status === a
  const contagem = (a: Aba) => fc.filtradas.filter((n) => naAba(n, a)).length
  // Sempre abre em "A conferir" (início do caminho da nota), como no NotaOK.
  const aba: Aba = abaEscolhida ?? 'pendente'
  const visiveis = fc.filtradas.filter((n) => naAba(n, aba))
  const valorAba = visiveis.reduce((s, n) => s + (n.valor ?? 0), 0)

  const paradas = notas.filter((n) => n.status === 'enviada' && (diasDesde(n.desde) ?? 0) >= DIAS_ALERTA)
  const devolvidas = notas.filter((n) => n.status === 'devolvida')
  const ultimaMudanca = notas.reduce((m, n) => (n.atualizado_em > m ? n.atualizado_em : m), '')
  const pedidoAtual = pedidoAberto ? pedidos.find((p) => p.id === pedidoAberto) ?? null : null
  const abrirNotaok = (n: NotaOkRow) => window.open(n.notaok_nota_id ? `${NOTAOK_URL}/notas/${n.notaok_nota_id}` : `${NOTAOK_URL}/notas`, '_blank', 'noopener')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Notas recebidas</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            Notas de entrada do NotaOK que ainda não foram lançadas no ERP. Quem confere e lança continua sendo o NotaOK.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {ultimaMudanca && <span className="text-[11px] text-gray-400">Última mudança recebida: {fmtDataHora(ultimaMudanca)}</span>}
          <button type="button" onClick={() => { notasQ.refetch(); pedidosQ.refetch() }} className={btnGhost} disabled={notasQ.isFetching}>
            <RefreshCw className={cn('h-4 w-4', notasQ.isFetching && 'animate-spin')} /> Atualizar
          </button>
        </div>
      </div>

      {paradas.length > 0 && (
        <button type="button" onClick={() => { setAba('enviada'); fc.limpar() }} className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-left text-[13px] text-amber-900 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <b className="font-semibold">{paradas.length === 1 ? '1 nota conferida está parada' : `${paradas.length} notas conferidas estão paradas`} há {DIAS_ALERTA} dias ou mais sem lançamento</b>
            {' '}({formatCurrencyInt(paradas.reduce((s, n) => s + (n.valor ?? 0), 0))}). Cobre o escritório: enquanto não lança, o estoque e o custo no ERP ficam desatualizados.
          </span>
        </button>
      )}
      {devolvidas.length > 0 && (
        <button type="button" onClick={() => { setAba('devolvida'); fc.limpar() }} className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-2.5 text-left text-[13px] text-red-900 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span><b className="font-semibold">{devolvidas.length === 1 ? '1 nota foi devolvida' : `${devolvidas.length} notas foram devolvidas`} para o recebimento corrigir.</b> O motivo aparece embaixo do fornecedor.</span>
        </button>
      )}

      <div className={containerCls}>
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-3 pt-2 dark:border-gray-800">
          {ABAS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)} className={cn('inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-[12.5px] font-semibold transition-colors', aba === a.id ? 'border-[#1e3a5f] text-[#1e3a5f] dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200')}>
              {a.label} <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', aba === a.id ? 'bg-[#1e3a5f]/10 dark:bg-blue-400/20' : 'bg-gray-100 dark:bg-gray-800')}>{contagem(a.id)}</span>
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2 self-center pb-1 text-[11px] text-gray-400">
            <span className="relative"><Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor ou nº" aria-label="Buscar nota" className={cn(inputCls, 'h-8 w-48 pl-7 text-[12px]')} /></span>
            <AvisoFiltros qtd={fc.qtdAtivos} onLimpar={fc.limpar} />
            {visiveis.length > 0 && <span className="tabular-nums">{visiveis.length} {visiveis.length === 1 ? 'nota' : 'notas'} · {formatCurrencyInt(valorAba)}</span>}
            <InfoHint text="A conferir: nota chegou do ERP e ninguém mexeu. Em conferência: o recebimento está conferindo a mercadoria. Devolvidas: o escritório devolveu para o recebimento corrigir. Aguardando lançamento: conferida, falta o escritório lançar no ERP. Parada há: tempo desde que a nota entrou na situação atual. As notas chegam do NotaOK sozinhas (em até 2 minutos); quando são lançadas, saem desta lista." />
          </span>
        </div>
        {notasQ.isLoading ? (
          <p className="inline-flex items-center gap-2 px-5 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando notas…</p>
        ) : notasQ.error ? (
          <p className="px-5 py-6 text-sm text-red-600">Não foi possível ler as notas: {(notasQ.error as Error).message}</p>
        ) : notasQ.data === null ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">As notas do NotaOK ainda não estão ligadas no Visor. Avise o suporte da CCI.</p>
        ) : visiveis.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            {notas.length === 0 ? 'Nenhuma nota pendente vinda do NotaOK. Se a rede usa o NotaOK e nada aparece, a ligação entre os dois pode estar desligada: avise o suporte da CCI.' : 'Nenhuma nota nesta aba com estes filtros.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold"><CabecalhoFiltro rotulo="NF" filtro={fc.de('nf')} /></th>
                  <th className="px-3 py-2 text-left font-semibold"><CabecalhoFiltro rotulo="Posto" filtro={fc.de('posto')} /></th>
                  <th className="px-3 py-2 text-left font-semibold"><CabecalhoFiltro rotulo="Fornecedor" filtro={fc.de('fornecedor')} /></th>
                  <th className="px-3 py-2 text-left font-semibold"><CabecalhoFiltro rotulo="Situação" filtro={fc.de('situacao')} /></th>
                  <th className="px-3 py-2 text-right font-semibold"><CabecalhoFiltro rotulo="Parada há" filtro={fc.de('parada')} alinhar="direita" /></th>
                  <th className="px-3 py-2 text-left font-semibold"><CabecalhoFiltro rotulo="Conferiu / devolveu" filtro={fc.de('quem')} /></th>
                  <th className="px-3 py-2 text-left font-semibold"><CabecalhoFiltro rotulo="Pedido" filtro={fc.de('pedido')} /></th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                  <th className="px-3 py-2 text-right font-semibold"><CabecalhoFiltro rotulo="Emissão" filtro={fc.de('emissao')} alinhar="direita" /></th>
                  <th className="px-4 py-2 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visiveis.map((n) => {
                  const dias = diasDesde(n.desde)
                  const atrasada = n.status === 'enviada' && (dias ?? 0) >= DIAS_ALERTA
                  const ligados = porNota.get(n.nota_chave) ?? []
                  const nota = n.status === 'devolvida' ? n.motivo : n.observacao
                  return (
                    <tr key={n.nota_chave} className={cn('align-top text-gray-800 dark:text-gray-200', atrasada && 'border-l-2 border-amber-400')}>
                      <td className="px-4 py-2 font-mono text-[12px] font-semibold tabular-nums text-[#1e3a5f] dark:text-blue-300">{nfDe(n)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{base.nomePosto(n.empresa_codigo)}</td>
                      <td className="max-w-[320px] px-3 py-2">
                        <span className="font-medium">{nomeProprio(n.fornecedor_nome ?? '—')}</span>
                        {nota && <span className={cn('mt-0.5 block text-[11px] leading-snug', n.status === 'devolvida' ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400')}>{n.status === 'devolvida' ? 'Motivo: ' : 'Recado: '}{nota}</span>}
                      </td>
                      <td className="px-3 py-2"><span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_NOTAOK[n.status].cor)}>{STATUS_NOTAOK[n.status].rotulo}</span></td>
                      <td className={cn('whitespace-nowrap px-3 py-2 text-right tabular-nums', atrasada ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300')}>{textoDias(dias)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{n.por_nome ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {ligados.length ? ligados.map((p) => (
                          <button key={p.pedido_id} type="button" onClick={() => setPedidoAberto(p.pedido_id)} className="mr-1 font-mono text-[12px] font-semibold text-[#2563eb] hover:underline dark:text-blue-300">nº {p.numero ?? '?'}</button>
                        )) : n.sem_pedido
                          ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">Sem pedido</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{n.valor != null ? formatCurrencyInt(n.valor) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-[11px] text-gray-500">{n.emissao ? fmtData(n.emissao) : '—'}</td>
                      <td className="px-4 py-2 text-right"><RowActionButton icon={ExternalLink} label="Abrir no NotaOK" onClick={() => abrirNotaok(n)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pedidoAtual && (
        <PedidoModal pedido={pedidoAtual} onClose={() => setPedidoAberto(null)} onMudou={invalidar} onEditar={() => setPedidoAberto(null)} tetos={tetos} pedidos={pedidos} />
      )}
    </div>
  )
}

export default NotasRecebidas
