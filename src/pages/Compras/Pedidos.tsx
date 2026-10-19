import { useMemo, useState } from 'react'
import { Plus, Search, Loader2, Gauge, AlertTriangle, Trash2 } from 'lucide-react'
import RowActionButton from '@/components/tables/RowAction'
import { Modal, Erro, ConfirmaAcao } from '@/pages/Gestao/comumUi'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { SETOR_LABEL, STATUS_LABEL, STATUS_META, apagarPedido, type PedidoRow, type SetorCompra, type StatusPedido } from '@/api/supabase/compras'
import { useComprasBase, containerCls, inputCls, selectCls, btnPrimary, btnGhost, fmtDataHora, nomeProprio } from './comum'
import { usePedidos } from './hooks/usePedidos'
import NovoPedidoModal from './NovoPedidoModal'
import PedidoModal from './PedidoModal'
import TetosModal from './TetosModal'

type Aba = 'todos' | 'rascunho' | 'aguardando' | 'liberados' | 'recebidos' | 'encerrados'
const ABAS: { id: Aba; label: string; status: StatusPedido[] | null }[] = [
  { id: 'todos', label: 'Todos', status: null },
  { id: 'rascunho', label: 'Rascunhos', status: ['rascunho'] },
  { id: 'aguardando', label: 'Aguardando', status: ['aguardando'] },
  { id: 'liberados', label: 'Liberados', status: ['liberado', 'liberado_parcial'] },
  { id: 'recebidos', label: 'Recebidos', status: ['recebido'] },
  { id: 'encerrados', label: 'Recusados e cancelados', status: ['recusado', 'cancelado'] },
]

export const Selo = ({ status }: { status: StatusPedido }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold', STATUS_META[status].cls)}>
    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[status].dot)} />{STATUS_LABEL[status]}
  </span>
)

/** Lista de pedidos com filtros, abas por situação e os modais de novo pedido, detalhe e tetos. */
const Pedidos = () => {
  const base = useComprasBase()
  const { pedidos, tetos, carregando, erro, invalidar } = usePedidos(base.redeId)
  const [aba, setAba] = useState<Aba>('todos')
  const [busca, setBusca] = useState('')
  const [posto, setPosto] = useState<number | ''>('')
  const [setor, setSetor] = useState<SetorCompra | ''>('')
  const [solicitante, setSolicitante] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [novo, setNovo] = useState(false)
  const [editando, setEditando] = useState<PedidoRow | null>(null)
  const [aberto, setAberto] = useState<PedidoRow | null>(null)
  const [aApagar, setAApagar] = useState<PedidoRow | null>(null)
  const [apagando, setApagando] = useState(false)
  const [erroApagar, setErroApagar] = useState<string | null>(null)
  const confirmarApagar = async (p: PedidoRow) => {
    setApagando(true); setErroApagar(null)
    try { await apagarPedido(p); invalidar(); setAApagar(null) } catch (e) { setErroApagar((e as Error).message) } finally { setApagando(false) }
  }
  const [tetosAberto, setTetosAberto] = useState(false)

  const solicitantes = useMemo(() => [...new Set(pedidos.map((p) => p.solicitante_nome).filter((x): x is string => !!x))].sort(), [pedidos])
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return pedidos.filter((p) => {
      if (posto !== '' && p.empresa_codigo !== posto) return false
      if (setor && p.setor !== setor) return false
      if (solicitante && p.solicitante_nome !== solicitante) return false
      if (de && p.criado_em.slice(0, 10) < de) return false
      if (ate && p.criado_em.slice(0, 10) > ate) return false
      if (t && !(p.fornecedor_nome.toLowerCase().includes(t) || String(p.numero) === t || base.nomePosto(p.empresa_codigo).toLowerCase().includes(t) || (p.observacoes ?? '').toLowerCase().includes(t))) return false
      return true
    })
  }, [pedidos, busca, posto, setor, solicitante, de, ate, base])
  const contagem = (a: Aba) => filtrados.filter((p) => !ABAS.find((x) => x.id === a)!.status || ABAS.find((x) => x.id === a)!.status!.includes(p.status)).length
  const visiveis = filtrados.filter((p) => { const st = ABAS.find((x) => x.id === aba)!.status; return !st || st.includes(p.status) })
  const aguardandoMeus = pedidos.filter((p) => p.status === 'aguardando').length
  // Pedido aberto a partir da lista atualizada (depois de uma ação o objeto muda).
  const abertoAtual = aberto ? pedidos.find((p) => p.id === aberto.id) ?? aberto : null

  return (
    <div className="space-y-4">
      {/* Cabeçalho com ações */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Pedidos de compra</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Sugestão de reposição, pedido e liberação. {base.podeLiberar ? 'Você libera pedidos nesta rede.' : 'Seus pedidos vão para quem libera.'}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {base.podeLiberar && <button type="button" onClick={() => setTetosAberto(true)} className={btnGhost}><Gauge className="h-4 w-4" /> Tetos do mês</button>}
          <button type="button" onClick={() => setNovo(true)} className={btnPrimary}><Plus className="h-4 w-4" /> Novo pedido</button>
        </div>
      </div>

      {base.podeLiberar && aguardandoMeus > 0 && (
        <button type="button" onClick={() => setAba('aguardando')} className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-left text-[13px] text-amber-900 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span><b className="font-semibold">{aguardandoMeus} {aguardandoMeus === 1 ? 'pedido aguarda' : 'pedidos aguardam'} sua liberação.</b> Clique para ver.</span>
        </button>
      )}

      {/* Filtros */}
      <div className={cn(containerCls, 'grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6')}>
        <label className="xl:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Buscar</span>
          <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Fornecedor, posto ou nº do pedido" className={cn(inputCls, 'pl-9')} /></span>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Posto</span>
          <select value={posto} onChange={(e) => setPosto(e.target.value ? Number(e.target.value) : '')} className={selectCls}>
            <option value="">Todos os postos</option>
            {base.postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia || p.razao}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Setor</span>
          <select value={setor} onChange={(e) => setSetor(e.target.value as SetorCompra | '')} className={selectCls}>
            <option value="">Todos</option>
            {(Object.keys(SETOR_LABEL) as SetorCompra[]).map((s) => <option key={s} value={s}>{SETOR_LABEL[s]}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Solicitante</span>
          <select value={solicitante} onChange={(e) => setSolicitante(e.target.value)} className={selectCls}>
            <option value="">Todos</option>
            {solicitantes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">De</span><input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} /></label>
          <label><span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Até</span><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} /></label>
        </div>
      </div>

      {/* Abas por situação + tabela */}
      <div className={containerCls}>
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-3 pt-2 dark:border-gray-800">
          {ABAS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)} className={cn('inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-[12.5px] font-semibold transition-colors', aba === a.id ? 'border-[#1e3a5f] text-[#1e3a5f] dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200')}>
              {a.label} <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', aba === a.id ? 'bg-[#1e3a5f]/10 dark:bg-blue-400/20' : 'bg-gray-100 dark:bg-gray-800')}>{contagem(a.id)}</span>
            </button>
          ))}
          <span className="ml-auto self-center pb-1 text-[11px] text-gray-400">Clique num pedido para abrir <InfoHint text="Rascunho: ainda não enviado. Aguardando: na fila de quem libera. Liberado / parcial: aprovado inteiro ou com cortes. Recebido: a mercadoria chegou. Recusado e cancelado: encerrados sem compra." /></span>
        </div>
        {carregando ? (
          <p className="inline-flex items-center gap-2 px-5 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pedidos…</p>
        ) : erro ? (
          <p className="px-5 py-6 text-sm text-red-600">Não foi possível ler os pedidos: {erro.message}</p>
        ) : visiveis.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">{pedidos.length === 0 ? 'Nenhum pedido ainda. Comece por "Novo pedido": o Visor sugere o que repor a partir do estoque.' : 'Nenhum pedido com estes filtros.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Nº</th>
                  <th className="px-3 py-2 text-left font-semibold">Posto</th>
                  <th className="px-3 py-2 text-left font-semibold">Fornecedor</th>
                  <th className="px-3 py-2 text-left font-semibold">Setor</th>
                  <th className="px-3 py-2 text-left font-semibold">Situação</th>
                  <th className="px-3 py-2 text-left font-semibold">Solicitante</th>
                  <th className="px-3 py-2 text-right font-semibold">Solicitado</th>
                  <th className="px-3 py-2 text-right font-semibold">Liberado</th>
                  <th className="px-4 py-2 text-right font-semibold">Data</th>
                  {base.podeApagar && <th className="px-4 py-2 text-right font-semibold">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visiveis.map((p) => (
                  <tr key={p.id} onClick={() => setAberto(p)} className={cn('cursor-pointer text-gray-800 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/60', p.status === 'aguardando' && base.podeLiberar && 'border-l-2 border-amber-400')}>
                    <td className="px-4 py-2 font-mono text-[12px] font-semibold tabular-nums text-[#1e3a5f] dark:text-blue-300">{p.numero}</td>
                    <td className="whitespace-nowrap px-3 py-2">{base.nomePosto(p.empresa_codigo)}</td>
                    <td className="px-3 py-2 font-medium">{nomeProprio(p.fornecedor_nome)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{SETOR_LABEL[p.setor]}</td>
                    <td className="px-3 py-2"><Selo status={p.status} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{p.solicitante_nome ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrencyInt(p.total_solicitado)}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', p.total_liberado != null ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-gray-400')}>{p.total_liberado != null ? formatCurrencyInt(p.total_liberado) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-[11px] text-gray-500">{fmtDataHora(p.criado_em)}</td>
                    {base.podeApagar && <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}><RowActionButton icon={Trash2} label="Apagar" tone="danger" onClick={() => { setErroApagar(null); setAApagar(p) }} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(novo || editando) && (
        <NovoPedidoModal open onClose={() => { setNovo(false); setEditando(null) }} pedido={editando} onSalvo={() => { invalidar(); setNovo(false); setEditando(null) }} tetos={tetos} pedidos={pedidos} />
      )}
      {abertoAtual && (
        <PedidoModal pedido={abertoAtual} onClose={() => setAberto(null)} onMudou={invalidar} onEditar={() => { setEditando(abertoAtual); setAberto(null) }} tetos={tetos} pedidos={pedidos} />
      )}
      {aApagar && (
        <Modal open onClose={() => setAApagar(null)} titulo={`Pedido nº ${aApagar.numero}`} largura="max-w-md">
          <div className="space-y-2">
            <Erro msg={erroApagar} />
            <ConfirmaAcao perigo titulo="Apagar de vez?" texto={<>Some o pedido de <b className="font-semibold">{nomeProprio(aApagar.fornecedor_nome)}</b> ({STATUS_LABEL[aApagar.status].toLowerCase()}), com os itens e o histórico. Use para limpar testes: não dá para desfazer.</>} rotulo="Apagar pedido" ocupado={apagando}
              onVoltar={() => setAApagar(null)} onConfirmar={() => confirmarApagar(aApagar)} />
          </div>
        </Modal>
      )}
      {tetosAberto && <TetosModal onClose={() => setTetosAberto(false)} tetos={tetos} pedidos={pedidos} onMudou={invalidar} />}
    </div>
  )
}

export default Pedidos
