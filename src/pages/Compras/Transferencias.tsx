import { useMemo, useState } from 'react'
import { Plus, Search, Loader2, ArrowRight, Send, Inbox, PackageOpen, History, Truck, Trash2 } from 'lucide-react'
import RowActionButton from '@/components/tables/RowAction'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { STATUS_TRANSF_LABEL, STATUS_TRANSF_META, despacharTransferencia, apagarTransferencia, type StatusTransf, type TransferenciaRow } from '@/api/supabase/compras'
import { useComprasBase, containerCls, inputCls, selectCls, btnPrimary, fmtDataHora, nomeProprio, qtdFmt } from './comum'
import { useTransferencias } from './hooks/useTransferencias'
import NovaTransferenciaModal from './NovaTransferenciaModal'
import TransferenciaModal from './TransferenciaModal'
import { Modal, Erro, ConfirmaAcao } from '@/pages/Gestao/comumUi'

type Aba = 'enviar' | 'receber' | 'andamento' | 'historico'
/** Abas pela AÇÃO pendente, não pelo status: quem abre a tela vê o que tem que fazer. */
const ABAS: { id: Aba; label: string; Icon: typeof Send; status: StatusTransf[]; dica: string }[] = [
  { id: 'enviar', label: 'A enviar', Icon: Send, status: ['solicitada'], dica: 'A origem separa a mercadoria e clica em Despachar quando ela sair.' },
  { id: 'receber', label: 'A receber', Icon: Inbox, status: ['em_transito'], dica: 'Quando os produtos chegarem, clique em Receber e confirme a quantidade.' },
  { id: 'andamento', label: 'Em andamento', Icon: PackageOpen, status: ['rascunho'], dica: 'Rascunhos ainda não solicitados à origem.' },
  { id: 'historico', label: 'Histórico', Icon: History, status: ['recebida', 'cancelada'], dica: 'Transferências recebidas e canceladas.' },
]
const abaDe = (st: StatusTransf): Aba => (st === 'solicitada' ? 'enviar' : st === 'em_transito' ? 'receber' : st === 'rascunho' ? 'andamento' : 'historico')

export const SeloTransf = ({ status }: { status: StatusTransf }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold', STATUS_TRANSF_META[status].cls)}>
    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_TRANSF_META[status].dot)} />{STATUS_TRANSF_LABEL[status]}
  </span>
)

/** Transferências entre postos: lista, faixa "para receber" e os modais. */
const Transferencias = () => {
  const base = useComprasBase()
  const { transferencias, itensPor, carregando, erro, invalidar } = useTransferencias(base.redeId)
  const [aba, setAba] = useState<Aba | null>(null)
  const [abertaModo, setAbertaModo] = useState<'conferir' | undefined>(undefined)
  const [despachando, setDespachando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [posto, setPosto] = useState<number | ''>('')
  const [nova, setNova] = useState(false)
  const [editando, setEditando] = useState<TransferenciaRow | null>(null)
  const [aberta, setAberta] = useState<TransferenciaRow | null>(null)

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return transferencias.filter((x) => {
      if (posto !== '' && x.origem_codigo !== posto && x.destino_codigo !== posto) return false
      if (t && !(String(x.numero) === t || base.nomePosto(x.origem_codigo).toLowerCase().includes(t) || base.nomePosto(x.destino_codigo).toLowerCase().includes(t) || (x.observacoes ?? '').toLowerCase().includes(t))) return false
      return true
    })
  }, [transferencias, busca, posto, base])
  const contagem = (a: Aba) => filtradas.filter((x) => abaDe(x.status) === a).length
  // Aba inicial: a primeira com algo a fazer (receber > enviar > andamento), senão histórico.
  const abaAtiva: Aba = aba ?? (contagem('receber') > 0 ? 'receber' : contagem('enviar') > 0 ? 'enviar' : contagem('andamento') > 0 ? 'andamento' : 'historico')
  const visiveis = filtradas.filter((x) => abaDe(x.status) === abaAtiva)
  const abertaAtual = aberta ? transferencias.find((x) => x.id === aberta.id) ?? aberta : null
  const [aApagar, setAApagar] = useState<TransferenciaRow | null>(null)
  const [apagando, setApagando] = useState(false)
  const [erroApagar, setErroApagar] = useState<string | null>(null)
  const confirmarApagar = async (x: TransferenciaRow) => {
    setApagando(true); setErroApagar(null)
    try { await apagarTransferencia(x); invalidar(); setAApagar(null) } catch (e) { setErroApagar((e as Error).message) } finally { setApagando(false) }
  }
  const [aDespachar, setADespachar] = useState<TransferenciaRow | null>(null)
  const [erroDesp, setErroDesp] = useState<string | null>(null)
  const despachar = async (x: TransferenciaRow) => {
    setDespachando(x.id); setErroDesp(null)
    try { await despacharTransferencia(x, base.autor); invalidar(); setADespachar(null) } catch (e) { setErroDesp((e as Error).message) } finally { setDespachando(null) }
  }
  const Andamento = ({ x }: { x: TransferenciaRow }) => (
    <ul className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-300">
      {x.solicitada_em && <li>Solicitada {fmtDataHora(x.solicitada_em)}{x.solicitante_nome ? ` · ${x.solicitante_nome}` : ''}</li>}
      {x.enviada_em && <li>Despachada {fmtDataHora(x.enviada_em)}{x.enviado_por_nome ? ` · ${x.enviado_por_nome}` : ''}</li>}
      {x.recebida_em && <li>Recebida {fmtDataHora(x.recebida_em)}{x.recebido_por_nome ? ` · ${x.recebido_por_nome}` : ''}</li>}
      {!x.solicitada_em && !x.enviada_em && !x.recebida_em && <li className="text-gray-400">Criada {fmtDataHora(x.criado_em)}</li>}
    </ul>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Transferências entre postos</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Um posto manda, o outro confere. O lançamento de estoque continua sendo feito no WebPosto.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setNova(true)} className={btnPrimary}><Plus className="h-4 w-4" /> Nova transferência</button>
        </div>
      </div>

      <div className={cn(containerCls, 'grid gap-3 p-4 md:grid-cols-3')}>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Buscar</span>
          <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Posto ou nº" className={cn(inputCls, 'pl-9')} /></span>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Posto (origem ou destino)</span>
          <select value={posto} onChange={(e) => setPosto(e.target.value ? Number(e.target.value) : '')} className={selectCls}>
            <option value="">Todos os postos</option>
            {base.postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia || p.razao}</option>)}
          </select>
        </label>
      </div>

      <div className={containerCls}>
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-3 pt-2 dark:border-gray-800">
          {ABAS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)} className={cn('inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-[12.5px] font-semibold transition-colors', abaAtiva === a.id ? 'border-[#1e3a5f] text-[#1e3a5f] dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200')}>
              <a.Icon className="h-3.5 w-3.5" /> {a.label} <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', abaAtiva === a.id ? 'bg-[#1e3a5f]/10 dark:bg-blue-400/20' : 'bg-gray-100 dark:bg-gray-800')}>{contagem(a.id)}</span>
            </button>
          ))}
          <span className="ml-auto self-center pb-1 text-[11px] text-gray-400"><InfoHint text="A enviar: a origem precisa despachar. A receber: saiu da origem, o destino confere. Em andamento: rascunhos. Histórico: recebidas e canceladas. Clique numa linha para abrir o detalhe." /></span>
        </div>
        <p className="border-b border-gray-100 px-4 py-2 text-[11.5px] text-gray-500 dark:border-gray-800 dark:text-gray-400">{ABAS.find((a) => a.id === abaAtiva)!.dica}</p>
        {carregando ? <p className="inline-flex items-center gap-2 px-5 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
          : erro ? <p className="px-5 py-6 text-sm text-red-600">Não foi possível ler as transferências: {erro.message}</p>
          : visiveis.length === 0 ? <p className="px-5 py-8 text-center text-sm text-gray-500">{transferencias.length === 0 ? 'Nenhuma transferência ainda. Em "Nova transferência" o Visor mostra o que o destino precisa e o que sobra na origem.' : 'Nada aqui no momento.'}</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Nº</th>
                    <th className="px-3 py-2 text-left font-semibold">Itens</th>
                    <th className="px-3 py-2 text-left font-semibold">De → para</th>
                    <th className="px-3 py-2 text-right font-semibold">Qtd</th>
                    <th className="px-3 py-2 text-left font-semibold">Situação</th>
                    <th className="px-3 py-2 text-left font-semibold">Andamento</th>
                    <th className="px-4 py-2 text-right font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visiveis.map((x) => {
                    const its = itensPor.get(x.id) ?? []
                    const qtdTotal = its.reduce((s, i) => s + (i.qtd_recebida ?? i.qtd), 0)
                    return (
                      <tr key={x.id} onClick={() => { setAbertaModo(undefined); setAberta(x) }} className="cursor-pointer text-gray-800 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/60">
                        <td className="px-4 py-2 align-top font-mono text-[12px] font-semibold tabular-nums text-[#1e3a5f] dark:text-blue-300">{x.numero}</td>
                        <td className="max-w-[320px] px-3 py-2 align-top">
                          <p className="font-medium">{its.length === 0 ? <span className="text-gray-400">sem itens</span> : its.length === 1 ? nomeProprio(its[0].produto_nome) : `${its.length} itens`}</p>
                          {its.length > 1 && <p className="truncate text-[10.5px] text-gray-400" title={its.map((i) => nomeProprio(i.produto_nome)).join(', ')}>{its.slice(0, 3).map((i) => nomeProprio(i.produto_nome)).join(', ')}{its.length > 3 ? '…' : ''}</p>}
                          {its.length === 1 && <p className="text-[10.5px] text-gray-400">cód. {its[0].produto_codigo}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top"><span className="inline-flex items-center gap-1.5 font-medium">{base.nomePosto(x.origem_codigo)} <ArrowRight className="h-3.5 w-3.5 text-gray-400" /> {base.nomePosto(x.destino_codigo)}</span></td>
                        <td className="px-3 py-2 text-right align-top tabular-nums">{its.length ? qtdFmt(qtdTotal) : '—'}</td>
                        <td className="px-3 py-2 align-top"><SeloTransf status={x.status} /></td>
                        <td className="px-3 py-2 align-top"><Andamento x={x} /></td>
                        <td className="whitespace-nowrap px-4 py-2 text-right align-top" onClick={(e) => e.stopPropagation()}>
                          {x.status === 'solicitada' && <button type="button" onClick={(e) => { e.stopPropagation(); setErroDesp(null); setADespachar(x) }} disabled={despachando === x.id} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 text-[12px] font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60 dark:bg-[#2563eb]">{despachando === x.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />} Despachar</button>}
                          {x.status === 'em_transito' && <button type="button" onClick={() => { setAbertaModo('conferir'); setAberta(x) }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-700"><Inbox className="h-3.5 w-3.5" /> Receber</button>}
                          {x.status === 'rascunho' && <button type="button" onClick={() => { setAbertaModo(undefined); setAberta(x) }} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Abrir</button>}
                          {(x.status === 'recebida' || x.status === 'cancelada') && !base.podeApagar && <span className="text-[11px] text-gray-400">{STATUS_TRANSF_LABEL[x.status]}</span>}
                          {base.podeApagar && <RowActionButton icon={Trash2} label="Apagar" tone="danger" className="ml-1.5 align-middle" onClick={() => { setErroApagar(null); setAApagar(x) }} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {(nova || editando) && <NovaTransferenciaModal open onClose={() => { setNova(false); setEditando(null) }} transferencia={editando} onSalvo={() => { invalidar(); setNova(false); setEditando(null) }} />}
      {abertaAtual && <TransferenciaModal key={`${abertaAtual.id}-${abertaModo ?? ''}`} transferencia={abertaAtual} modoInicial={abertaModo} onClose={() => setAberta(null)} onMudou={invalidar} onEditar={() => { setEditando(abertaAtual); setAberta(null) }} />}
      {aApagar && (
        <Modal open onClose={() => setAApagar(null)} titulo={`Transferência nº ${aApagar.numero}`} largura="max-w-md">
          <div className="space-y-2">
            <Erro msg={erroApagar} />
            <ConfirmaAcao perigo titulo="Apagar de vez?" texto={<>Some a transferência de <b className="font-semibold">{base.nomePosto(aApagar.origem_codigo)}</b> para <b className="font-semibold">{base.nomePosto(aApagar.destino_codigo)}</b> ({STATUS_TRANSF_LABEL[aApagar.status].toLowerCase()}), com os itens e o histórico. Use para limpar testes: não dá para desfazer.</>} rotulo="Apagar transferência" ocupado={apagando}
              onVoltar={() => setAApagar(null)} onConfirmar={() => confirmarApagar(aApagar)} />
          </div>
        </Modal>
      )}
      {aDespachar && (
        <Modal open onClose={() => setADespachar(null)} titulo={`Transferência nº ${aDespachar.numero}`} largura="max-w-md">
          <div className="space-y-2">
            <Erro msg={erroDesp} />
            <ConfirmaAcao titulo="Despachar agora?" texto={<>Sai de <b className="font-semibold">{base.nomePosto(aDespachar.origem_codigo)}</b> para <b className="font-semibold">{base.nomePosto(aDespachar.destino_codigo)}</b>. O destino passa a ver para conferir.</>} rotulo="Despachar" ocupado={despachando === aDespachar.id}
              onVoltar={() => setADespachar(null)} onConfirmar={() => despachar(aDespachar)} />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Transferencias
